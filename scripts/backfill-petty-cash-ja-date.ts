import prisma from '../lib/prisma'

/**
 * Backfill: move existing petty cash liquidation journal entries (LIQ-) to the
 * disbursement date instead of the approval date. The API now records new
 * liquidations at the disbursement date; this script corrects pre-existing ones.
 *
 * Matching strategy (reliable because both timestamps are set in the same
 * request): JE.date (approval time) vs liquidation.approvedAt within 5s,
 * disambiguated by the disbursement description embedded in the JE description.
 *
 * Idempotent: only touches LIQ- JEs whose date differs from their disbursement date.
 */
async function main() {
  // 1. Load all LIQ- journal entries
  const jes = await prisma.journalEntry.findMany({
    where: { reference: { startsWith: 'LIQ-' } },
    select: { id: true, reference: true, date: true, description: true },
  })

  // 2. Load liquidations + linked disbursements
  const liqs = await prisma.pettyCashLiquidation.findMany({
    select: {
      id: true,
      approvedAt: true,
      disbursementId: true,
      date: true,
    },
  })

  // 3. Load disbursements (id -> date + description)
  const disbs = await prisma.pettyCashDisbursement.findMany({
    select: { id: true, date: true, description: true },
  })
  const disbById = new Map(disbs.map((d) => [d.id, d]))

  // 4. Build liquidation lookup with disbursement info
  const liqCandidates = liqs
    .filter((l) => l.approvedAt && l.disbursementId)
    .map((l) => {
      const disb = disbById.get(l.disbursementId)
      return {
        approvedAt: l.approvedAt as Date,
        disbDate: disb?.date ?? null,
        disbDesc: (disb?.description || '').trim().toLowerCase(),
      }
    })
    .filter((c) => c.disbDate)

  console.log(`LIQ- JEs: ${jes.length} | liquidations with disbursement date: ${liqCandidates.length}`)

  let updated = 0
  let skipped = 0

  for (const je of jes) {
    // Extract disbursement description from JE description: "Petty Cash Liquidation - <desc>"
    const suffix = je.description?.replace(/^Petty Cash Liquidation - /i, '').trim().toLowerCase() || ''

    // Candidates within 5 seconds of the JE approval date
    const jeTime = je.date.getTime()
    let candidates = liqCandidates.filter(
      (c) => Math.abs(c.approvedAt.getTime() - jeTime) <= 5000
    )

    // Disambiguate by description
    if (suffix) {
      const byDesc = candidates.filter((c) => c.disbDesc === suffix)
      if (byDesc.length > 0) candidates = byDesc
    }

    // Fallback: description-only match if time match found nothing
    if (candidates.length === 0 && suffix) {
      candidates = liqCandidates.filter((c) => c.disbDesc === suffix)
    }

    if (candidates.length === 0) {
      console.log(`  SKIP ${je.reference} (${je.date.toISOString()}): no matching liquidation/disbursement`)
      skipped++
      continue
    }

    // Pick closest by time
    candidates.sort((a, b) => Math.abs(a.approvedAt.getTime() - jeTime) - Math.abs(b.approvedAt.getTime() - jeTime))
    const disbDate = candidates[0].disbDate as Date

    const sameDay = disbDate.toISOString().split('T')[0] === je.date.toISOString().split('T')[0]
    if (sameDay) {
      skipped++
      continue
    }

    await prisma.journalEntry.update({
      where: { id: je.id },
      data: { date: disbDate },
    })
    console.log(
      `  UPDATED ${je.reference}: ${je.date.toISOString().split('T')[0]} -> ${disbDate.toISOString().split('T')[0]}`
    )
    updated++
  }

  console.log(`\nDone. ${updated} journal entr(y/ies) moved to disbursement date. ${skipped} unchanged/skipped.`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
