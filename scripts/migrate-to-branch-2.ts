import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BRANCH_2_ID = '6a0fd014f7bd3aa75af04e71'

async function main() {
  console.log(`Migrating all accounting/asset records to Branch-2 (${BRANCH_2_ID})...\n`)

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
        q: { branchId: null },
        u: { $set: { branchId: BRANCH_2_ID } },
        multi: true,
      }],
    })

    const count = Number(result.nModified || result.n || 0)
    total += count
    console.log(`${collection}: ${count} records updated`)
  }

  // Verify
  let remaining = 0
  for (const collection of collections) {
    const result: any = await prisma.$runCommandRaw({
      count: collection,
      query: { branchId: null },
    })
    remaining += Number(result.n || 0)
  }

  console.log(`\nDone. Total migrated: ${total}. Records still null: ${remaining}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
