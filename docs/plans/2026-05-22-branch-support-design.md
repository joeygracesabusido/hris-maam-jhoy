# Multi-Branch Support for Accounting & Asset Inventory

## Overview

Add branch-level data isolation to the accounting and asset inventory modules. Users can create branches, assign transactions to branches, and filter views by branch or see consolidated data across all branches.

## Architecture

```
BranchProvider (Context + Cookie)
  ├── provides: { selectedBranch, branches, setBranch }
  ├── cookie: activeBranchId (persists selection)
  └── wraps: all accounting/asset pages via layout

API Layer
  ├── GET /api/branches              — list all branches
  ├── POST /api/branches             — create branch
  ├── PATCH /api/branches/[id]       — update branch
  ├── DELETE /api/branches/[id]      — delete branch
  └── All accounting APIs accept ?branchId= filter

Data Layer (Prisma)
  ├── model Branch { id, name, code, address, contactPerson, contactPhone, contactEmail, isActive }
  ├── branchId on: JournalEntry, Expense, SalesInvoice, PurchaseBill, Payment
  ├── branchId on: PettyCash, PettyCashDisbursement, PettyCashLiquidation
  ├── branchId on: Asset, AssetCategory, AssetTransaction
  └── branchId on: SubsidiaryLedger
```

## Prisma Schema

### Branch Model

```prisma
model Branch {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  name          String   @unique
  code          String   @unique
  address       String?
  contactPerson String?
  contactPhone  String?
  contactEmail  String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  journalEntries           JournalEntry[]
  expenses                 Expense[]
  salesInvoices            SalesInvoice[]
  purchaseBills            PurchaseBill[]
  payments                 Payment[]
  pettyCashFunds           PettyCash[]
  pettyCashDisbursements    PettyCashDisbursement[]
  pettyCashLiquidations    PettyCashLiquidation[]
  assets                   Asset[]
  assetCategories          AssetCategory[]
  assetTransactions        AssetTransaction[]
  subsidiaryLedgers        SubsidiaryLedger[]

  @@map("branches")
}
```

### Fields to add to existing models

Each model gets:
```prisma
branchId String? @db.ObjectId
branch   Branch? @relation(fields: [branchId], references: [id])

@@index([branchId])
```

Models: JournalEntry, Expense, SalesInvoice, PurchaseBill, Payment, PettyCash, PettyCashDisbursement, PettyCashLiquidation, Asset, AssetCategory, AssetTransaction, SubsidiaryLedger

## Frontend Components

### BranchProvider (`lib/branch-context.tsx`)
- `'use client'` React context
- On mount: fetch `GET /api/branches`, read `activeBranchId` cookie
- `setBranch(branch)`: set cookie + update state
- `selectedBranch`: `Branch | null` (null = "All")

### BranchSelector (`components/branch-selector.tsx`)
- Dropdown/chip selector showing all branches + "All" option
- Used in: settings page, accounting layout header

### Settings Page Changes
- New "Branches" section below existing office locations
- Form: name, code, address, contact person, phone, email
- List: existing branches with edit/delete
- First-use prompt when no branches exist

## API Changes

### New Routes
- `GET /api/branches` — list active branches
- `POST /api/branches` — create branch
- `PATCH /api/branches/[id]` — update branch
- `DELETE /api/branches/[id]` — delete (only if unused)

### Existing Routes Pattern
Every accounting GET handler updated to:
```typescript
const branchId = searchParams.get('branchId')
const where: any = {}
if (branchId) where.branchId = branchId
```

Every POST/PATCH handler updated to:
```typescript
const { branchId, ... } = body
// Save branchId alongside other fields
```

## Migration Strategy

1. Schema push adds Branch model + branchId fields (nullable)
2. On first settings visit: if `branches.length === 0`, show setup prompt
3. Admin creates initial branch (e.g., "Main Office")
4. "Migrate existing data" button runs:
   ```typescript
   await prisma.journalEntry.updateMany({ data: { branchId } })
   await prisma.expense.updateMany({ data: { branchId } })
   // ... etc
   ```
5. After migration, branchId becomes effectively required for new records

## Filter Behavior

| Selection | Behavior |
|-----------|----------|
| "All" (null) | No branchId filter — returns ALL records across all branches |
| Specific branch | `where: { branchId }` — returns only that branch's records |

## Implementation Order

1. Prisma schema changes + db push
2. Branch CRUD API routes
3. BranchProvider context + BranchSelector component
4. Settings page branch management section
5. Update accounting API routes (GET handlers — add branch filter)
6. Update accounting API routes (POST/PATCH handlers — save branchId)
7. Update accounting frontend pages (consume BranchContext, pass ?branchId)
8. Update asset inventory API routes + pages
9. Migration script / first-setup flow
10. Tests / verification
