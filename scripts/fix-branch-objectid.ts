import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BRANCH_2_ID = '6a0fd014f7bd3aa75af04e71'

async function main() {
  console.log(`Converting branchId from string to ObjectId for Branch-2 (${BRANCH_2_ID})...\n`)

  const collections = [
    'journal_entries', 'expenses', 'sales_invoices', 'purchase_bills',
    'payments', 'petty_cash', 'petty_cash_disbursements', 'petty_cash_liquidations',
    'assets', 'assetcategories', 'assettransactions', 'subsidiary_ledgers',
  ]

  let total = 0

  for (const collection of collections) {
    const result: any = await prisma.$runCommandRaw({
      update: collection,
      updates: [{
        q: { branchId: { $type: 'string' } },
        u: [{ $set: { branchId: { $toObjectId: '$branchId' } } }],
        multi: true,
      }],
    })

    const count = Number(result.nModified || result.n || 0)
    total += count
    console.log(`${collection}: ${count} records fixed`)
  }

  // Verify with Prisma query
  const count = await prisma.journalEntry.count({
    where: { branchId: BRANCH_2_ID },
  })
  console.log(`\nPrisma query: ${count} journal entries found with branchId = Branch-2`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
