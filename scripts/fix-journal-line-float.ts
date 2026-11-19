import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COLLECTION = 'journal_lines'

async function main() {
  console.log(`Scanning ${COLLECTION} for Decimal128 (BSON 'decimal') debit/credit...`)

  // 1. Diagnose: count records where debit or credit is stored as Decimal128
  const before: any = await prisma.$runCommandRaw({
    count: COLLECTION,
    query: {
      $or: [
        { debit: { $type: 'decimal' } },
        { credit: { $type: 'decimal' } },
      ],
    },
  })
  const beforeCount = Number(before.n || 0)
  console.log(`Corrupted journal lines (decimal debit/credit) before fix: ${beforeCount}`)

  if (beforeCount === 0) {
    console.log('No corrupted journal lines found. Nothing to fix.')
    return
  }

  // Show a few examples for the record
  const sample: any = await prisma.$runCommandRaw({
    aggregate: COLLECTION,
    pipeline: [
      {
        $match: {
          $or: [
            { debit: { $type: 'decimal' } },
            { credit: { $type: 'decimal' } },
          ],
        },
      },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          entryId: 1,
          accountId: 1,
          debit: 1,
          credit: 1,
          debitType: { $type: '$debit' },
          creditType: { $type: '$credit' },
        },
      },
    ],
    cursor: {},
  })
  console.log('Sample corrupted records:', JSON.stringify(sample.result, null, 2))

  // 2. Fix: convert Decimal128 debit/credit to double via aggregation-pipeline update.
  //    $toDouble handles Decimal128 ('1000.00' -> 1000). Fallback to 0 on error mirrors
  //    the app's own parseFloat(...) || 0 handling in create/update paths.
  const result: any = await prisma.$runCommandRaw({
    update: COLLECTION,
    updates: [
      {
        q: {
          $or: [
            { debit: { $type: 'decimal' } },
            { credit: { $type: 'decimal' } },
          ],
        },
        u: [
          {
            $set: {
              debit: {
                $convert: { input: '$debit', to: 'double', onError: 0, onNull: 0 },
              },
              credit: {
                $convert: { input: '$credit', to: 'double', onError: 0, onNull: 0 },
              },
            },
          },
        ],
        multi: true,
      },
    ],
  })

  const fixed = Number(result.nModified || result.n || 0)
  console.log(`Fixed ${fixed} journal line(s)`)

  // 3. Verify: no decimal-typed debit/credit should remain
  const after: any = await prisma.$runCommandRaw({
    count: COLLECTION,
    query: {
      $or: [
        { debit: { $type: 'decimal' } },
        { credit: { $type: 'decimal' } },
      ],
    },
  })
  const afterCount = Number(after.n || 0)
  console.log(`Corrupted journal lines remaining after fix: ${afterCount}`)

  // 4. Verify: Prisma can now read entries with lines included (the path that threw P2023)
  const entries = await prisma.journalEntry.findMany({
    include: {
      lines: {
        include: { account: true },
      },
    },
    take: 5,
    orderBy: { date: 'desc' },
  })
  const totalLines = entries.reduce((sum, e) => sum + e.lines.length, 0)
  console.log(
    `Prisma include test: read ${entries.length} entries with ${totalLines} line(s) OK`
  )

  console.log('\nDone.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
