import prisma from '../lib/prisma'

/**
 * Backfill: assign branchId to petty cash journal entries (PCF-/REP-/LIQ-)
 * that were created without one. Root cause: journalEntry.create calls in the
 * petty cash module did not propagate branchId (now fixed in the API routes).
 *
 * NOTE: Prisma's `where: { branchId: null }` does NOT match null values on
 * MongoDB, so we fetch all petty cash JEs and filter nulls in JS.
 *
 * Idempotent: only touches entries where branchId IS NULL.
 */
async function main() {
  const allPettyCashJEs = await prisma.journalEntry.findMany({
    where: {
      OR: [
        { reference: { startsWith: 'PCF-' } },
        { reference: { startsWith: 'REP-' } },
        { reference: { startsWith: 'LIQ-' } },
      ],
    },
    select: { id: true, reference: true, description: true, date: true, branchId: true },
    orderBy: { date: 'asc' },
  })

  const nullJEs = allPettyCashJEs.filter((je) => !je.branchId)
  console.log(`Petty cash JEs: ${allPettyCashJEs.length} | with null branchId: ${nullJEs.length}`)

  // Preload funds by name
  const funds = await prisma.pettyCash.findMany({ select: { name: true, branchId: true } })
  const fundByLowerName = new Map<string, string | null>()
  funds.forEach((f) => fundByLowerName.set(f.name.toLowerCase(), f.branchId))

  // Preload disbursement descriptions -> branchId
  const disbs = await prisma.pettyCashDisbursement.findMany({
    select: { id: true, description: true, branchId: true },
  })
  const disbBranchByLowerDesc = new Map<string, string | null>()
  disbs.forEach((d) => {
    const key = (d.description || '').toLowerCase().trim()
    if (!disbBranchByLowerDesc.has(key) && d.branchId) {
      disbBranchByLowerDesc.set(key, d.branchId)
    }
  })

  // Preload liquidations: disbursementId -> branchId (fallback source)
  const liqs = await prisma.pettyCashLiquidation.findMany({
    select: { disbursementId: true, branchId: true },
  })
  const liqBranchByDisbId = new Map<string, string | null>()
  liqs.forEach((l) => {
    if (!liqBranchByDisbId.has(l.disbursementId) && l.branchId) {
      liqBranchByDisbId.set(l.disbursementId, l.branchId)
    }
  })

  let updated = 0
  for (const je of nullJEs) {
    let branchId: string | null = null

    if (je.reference?.startsWith('PCF-')) {
      // "Petty Cash Fund - <fund name>"
      const m = je.description?.match(/Petty Cash Fund - (.+)$/i)
      if (m) branchId = fundByLowerName.get(m[1].trim().toLowerCase()) || null
    } else if (je.reference?.startsWith('LIQ-')) {
      // "Petty Cash Liquidation - <disbursement description>"
      const m = je.description?.match(/Petty Cash Liquidation - (.+)$/i)
      if (m) {
        branchId = disbBranchByLowerDesc.get(m[1].trim().toLowerCase()) || null
        if (!branchId) {
          // Fallback: liquidation branchId by disbursement link
          const disb = disbs.find((d) => (d.description || '').toLowerCase().trim() === m[1].trim().toLowerCase())
          if (disb) branchId = liqBranchByDisbId.get(disb.id) || null
        }
      }
    }

    if (!branchId) {
      console.log(`  SKIP ${je.reference} (${je.date.toISOString().split('T')[0]}): branchId could not be derived - "${je.description}"`)
      continue
    }

    await prisma.journalEntry.update({
      where: { id: je.id },
      data: { branchId },
    })
    console.log(`  UPDATED ${je.reference} (${je.date.toISOString().split('T')[0]}) -> branchId ${branchId} | "${je.description}"`)
    updated++
  }

  console.log(`\nDone. ${updated} journal entr(y/ies) updated.`)

  const remaining = allPettyCashJEs.filter((je) => !je.branchId).length - updated
  console.log(`Remaining petty cash JEs with null branchId: ${remaining}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
