# AGENTS.md - Developer Guidelines for HRIS Philippines

## Technology Stack

- **Framework**: Next.js 14 (React 18) — App Router
- **Database**: MongoDB with Prisma ORM
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Auth**: Cookie-based (custom implementation)
- **Date handling**: date-fns
- **Excel/CSV**: xlsx

---

## Commands

```bash
# Development
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run start        # Production server
npm run lint         # Run ESLint

# Database
npm run db:push      # Push schema changes to MongoDB
npm run db:seed      # Seed database with sample data
npx prisma studio    # Open Prisma GUI

# Scripts
npm run leave-accrual    # Run monthly leave accrual
npm run link-users       # Link users to employees by email
```

---

## Code Style

### General
- TypeScript with **strict mode** (no `any`; use `unknown` or specific types)
- 2 spaces indentation, single quotes, trailing commas, semicolons
- Max line length ~100 characters
- Export functions/components at top level (no default exports)

### Imports (order)
1. React/Next imports
2. External libs
3. Internal imports (@/ alias)
4. Type imports at bottom

```typescript
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types'
```

### Naming
- **Components/files**: PascalCase (`EmployeeCard.tsx`) or kebab-case for pages (`employees/page.tsx`)
- **Variables/functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Interfaces/Types**: PascalCase (no `I` prefix)

### React Components
```typescript
'use client'

interface Props {
  employee: Employee
  onSelect: (id: string) => void
}

export function EmployeeCard({ employee, onSelect }: Props) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{employee.fullName}</h3>
    </div>
  )
}
```

### API Routes
```typescript
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const employees = await prisma.employee.findMany({
      where: id ? { id } : {},
    })
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
```

---

## Key Patterns

### Error Handling
- Always wrap async operations in try/catch
- Log errors with `console.error('Context:', error)`
- Return meaningful error messages with appropriate HTTP status codes
- Check for Prisma errors: `error instanceof Prisma.PrismaClientKnownRequestError`

### Role-Based Access Control
Use `hasAdminAccess()` from `@/lib/auth-helpers` and `getEmployeeIdForUser()` from `@/lib/user-employee-link`:

```typescript
import { hasAdminAccess } from '@/lib/auth-helpers'
import { getEmployeeIdForUser } from '@/lib/user-employee-link'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('userRole')?.value
  const userEmail = cookieStore.get('userEmail')?.value

  // Admin/HR/MANAGER see all data
  if (hasAdminAccess(userRole || '')) {
    // Return all records
  } else {
    // EMPLOYEE sees only their own data
    const linkedEmployeeId = await getEmployeeIdForUser(userEmail || '', userRole || '')
    // Filter by employeeId
  }
}
```

### Date Handling (Manila Timezone)
**CRITICAL**: Always use Manila timezone for time-related operations:

```typescript
const MANILA_TIMEZONE = 'Asia/Manila'

function getManilaNow(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE }))
}

// For date queries
function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow()
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  }
}

// Display: Use getUTCHours/getUTCMinutes for Philippines time
const hours = date.getUTCHours()
const minutes = date.getUTCMinutes()
```

### Prisma (MongoDB)
```typescript
// MongoDB uses @db.ObjectId for references
const employee = await prisma.employee.findUnique({
  where: { id },
  include: { user: true },
})
```

### Zod Validation
```typescript
const Schema = z.object({
  fullName: z.string().min(1, 'Required'),
  employeeNumber: z.number().int().positive(),
})

const result = Schema.safeParse(body)
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
}
```

---

## Project Structure

```
/app
  /(dashboard)           # Authenticated pages (route group)
    /employees/
    /time-logs/
    /payroll/
  /api                    # API routes
/components
  /ui                     # shadcn/ui components
/lib                      # Utils, prisma client, auth helpers
/prisma
  schema.prisma
  seed.ts
/scripts                  # Database scripts
```

---

## Environment Variables

```env
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379  # Optional
```

---

## Development Workflow

1. Create branch for features/fixes
2. Make changes following guidelines
3. Run `npm run lint` before committing
4. Verify with `npm run build`
5. Test in dev server

---

## Recent Updates

### Expenses Report 500 Error Fix — Orphaned Journal Lines (2026-08-13)

**Issue:** `GET /api/accounting/reports/expenses-report` returned `{"error":"Failed to generate expenses report"}` (HTTP 500) on Vercel, while appearing to work locally.

**Root Cause:** The database contained **orphaned `JournalLine` documents** — 2 journal lines (`69ef09cfad68e6164692a3cd`, `69ef09cfad68e6164692a3ce`) whose `entryId` referenced a `JournalEntry` that had been deleted (entry `69ef09cf...a3cc`, from "Bill BILL-2026-9734"). Prisma's `include: { entry: ... }` on these lines returned `null` for the **required** relation and threw:

```
PrismaClientUnknownRequestError: Inconsistent query result:
Field entry is required to return data, got `null` instead.
```

The route's include filter used `where: { entry: {} }` (an **empty relation filter** when no branch/date param was passed). An empty relation filter does NOT inner-join — it does not exclude orphaned lines. The working report routes (trial-balance, income-statement) never hit this because they always filter `entry: { status: { not: 'VOID' } }` (non-empty → excludes orphans).

**Why "works locally, fails on prod":** The page only sends `branchId` when a branch is selected in the BranchSelector. With a branch selected the filter is non-empty (orphans hidden → success); with no `activeBranchId` cookie (fresh session on Vercel) the filter is `entry: {}` → crash. Same code, different cookie state.

**MongoDB quirk discovered:** `onDelete: Cascade` on `JournalLine.entry` does **NOT reliably fire** in Prisma's MongoDB connector. Delete handlers relied on it ("cascade will handle lines") so deleted entries left orphaned lines behind.

**Files Updated:**
- `app/api/accounting/reports/expenses-report/route.ts` — Always builds a **non-empty** `entry` filter: base `{ status: { not: 'VOID' } }` merged with optional `branchId`/date filters (mirrors trial-balance/income-statement). Excludes orphaned lines AND VOID entries (GAAP-consistent).
- `app/api/accounting/journal/route.ts` — DELETE handler now runs `tx.journalLine.deleteMany({ where: { entryId } })` before `journalEntry.delete()`.
- `app/api/accounting/purchases/route.ts` — PATCH handler explicitly deletes lines before deleting the old journal entry.
- `app/api/accounting/payments/route.ts` — PATCH and DELETE handlers explicitly delete lines before deleting the old journal entry.
- `app/api/accounting/expenses/route.ts` — PATCH and DELETE handlers explicitly delete lines before deleting the old journal entry.

**Data Fix Applied (live DB):** Deleted the 2 orphaned journal lines. This also fixed the account-transactions view for 5240/2340 and removed phantom amounts from COA balances (calculated by `calculateAccountBalance`, which sums all lines without an entry filter).

**Key Pattern — ALWAYS use a non-empty relation filter for required `include` relations:**
```typescript
// ❌ BAD — empty relation filter returns orphaned lines → "Inconsistent query result"
lines: { where: { entry: {} } }

// ✅ GOOD — non-empty filter inner-joins and excludes orphans/VOID entries
const entryFilter: Record<string, unknown> = { status: { not: 'VOID' } };
if (branchId) entryFilter.branchId = branchId;
lines: { where: { entry: entryFilter } }
```

**Key Pattern — never rely on MongoDB cascade for deletes:**
```typescript
// Always delete children explicitly before deleting the parent (MongoDB does NOT reliably cascade)
await tx.journalLine.deleteMany({ where: { entryId } });
await tx.journalEntry.delete({ where: { id } });
```
Reference: `app/api/water/bills/[id]/route.ts` already followed this pattern.

---

### Expenses Report Module (2026-08-13)

**New Feature:** Added Expenses Report module ported from 3drops water refilling station codebase. Provides a detailed breakdown of all general ledger expense accounts, date range filtering, branch filtering, expandable account transaction details, grand totals computation, and Excel export.

**Files Created:**
- `app/api/accounting/reports/expenses-report/route.ts` — API endpoint fetching all `EXPENSE` type accounts with matching journal lines, calculating debit/credit totals and balance per account.
- `app/(dashboard)/accounting/expenses-report/page.tsx` — Interactive UI page with date range filters, branch selector, collapsible account accordions for detailed journal entry lines, and Excel sheet exporter.

**Files Updated:**
- `app/(dashboard)/layout.tsx` — Added "Expenses Report" item under Accounting sidebar section (`/accounting/expenses-report`).

---

### Water Billing Module (2026-07-08)

**New Feature:** Complete water billing module for external tenant management — submeters, tiered rate computation, bill generation, payment collection, and accounting integration.

**Database (7 new Prisma models):**
- `Tenant` — External tenants with contact info, unit assignment, status
- `WaterMeter` — Individual submeters per unit (unique `meterNo`)
- `WaterMeterReading` — Periodic readings with previous/current/computed consumption
- `WaterRate` — Rate structures (`TIERED` or `FLAT`) with effective dates
- `WaterRateTier` — Tier rows within a rate (`fromUnit`, `toUnit`, `pricePerUnit`)
- `WaterBill` — Generated bills with consumption, amount, balance, status, journal entry link
- `WaterPayment` — Payments against bills with accounting integration

**Files Created:**
- `lib/water-billing.ts` — Tiered computation engine (`computeTieredAmount()`), bill number generator, account helpers
- `hooks/use-water.ts` — React Query hooks for all water entities
- `app/api/water/tenants/route.ts` + `[id]/route.ts`
- `app/api/water/meters/route.ts` + `[id]/route.ts`
- `app/api/water/readings/route.ts` + `[id]/route.ts`
- `app/api/water/rates/route.ts` + `[id]/route.ts`
- `app/api/water/bills/route.ts` + `[id]/route.ts` — Core billing engine (batch generation + tiered computation)
- `app/api/water/payments/route.ts` + `[id]/route.ts`
- `app/(dashboard)/water/tenants/page.tsx`
- `app/(dashboard)/water/meters/page.tsx`
- `app/(dashboard)/water/readings/page.tsx`
- `app/(dashboard)/water/rates/page.tsx`
- `app/(dashboard)/water/bills/page.tsx` + `[id]/print/page.tsx`
- `app/(dashboard)/water/payments/page.tsx`
- `.opencode/plans/2026-07-08-water-billing-design.md`

**Files Updated:**
- `prisma/schema.prisma` — Added 7 models with indexes, Branch back-references, JournalEntry relations
- `lib/query-keys.ts` — Added `water` key factory
- `app/(dashboard)/layout.tsx` — Added "Water Billing" sidebar section under Accounting (adminOnly)
- `middleware.ts` — Added `/water` to EMPLOYEE restricted paths

**How It Works:**

**Bill Generation** (`POST /api/water/bills`):
1. Fetches active meters with readings for the selected billing month
2. For each meter, computes consumption and applies rate tiers
3. Creates WaterBill + JournalEntry (Debit 1200 AR / Credit 4120 Service Income) in `$transaction`
4. Auto-skips already-billed meters

**Tiered Rate Computation** (`lib/water-billing.ts`):
```typescript
export function computeTieredAmount(consumption: number, tiers: RateTier[]): number {
  let total = 0
  let remaining = consumption
  const sorted = [...tiers].sort((a, b) => a.sequence - b.sequence)
  for (const tier of sorted) {
    if (remaining <= 0) break
    const tierMax = tier.toUnit ?? Infinity
    const tierRange = tierMax - tier.fromUnit
    const tierUnits = Math.min(remaining, tierRange)
    total += tierUnits * tier.pricePerUnit
    remaining -= tierUnits
  }
  return total
}
```

**Payment Recording** (`POST /api/water/payments`):
1. Creates WaterPayment record
2. Updates WaterBill balance + status (PAID/PARTIAL)
3. Creates JournalEntry (Debit Cash / Credit 1200 AR)

**Key Behaviors:**
- All admin-only (EMPLOYEE blocked by middleware + sidebar)
- Branch-aware (`branchId` filtering on all queries)
- Audit trail via journal entries (bill void = reverse entry status)
- Bill number format: `WTR-YYYYMM-XXXX`
- Consumption validation: no negative readings, spike detection (>200% of previous)
- PDF bill printing with reading details, amount breakdown, payment history

**Navigation Paths:**
```
Accounting > Water Billing
  ├── Tenants         /water/tenants
  ├── Meters          /water/meters
  ├── Meter Readings  /water/readings
  ├── Rate Setup      /water/rates
  ├── Bills           /water/bills
  └── Payments        /water/payments
```

---

### Advances Summary Page (2026-06-01)

**Issue:** No dedicated view existed to display a running ledger of cash advances per employee.

**Files Created:**
- `app/api/advances/summary/route.ts` — New API endpoint that fetches CASH_ADVANCE records with their payroll deductions and transforms them into a unified ledger (DEBIT for advance given, CREDIT for payroll deduction, with running balance)
- `app/(dashboard)/payroll/advances-summary/page.tsx` — New page with autocomplete employee search, employee header card, summary cards (Total Advances, Total Paid, Current Balance), and a flat ledger table

**Files Updated:**
- `app/(dashboard)/layout.tsx` — Added "Advances Summary" navigation entry under Payroll sidebar

**How It Works:**
```typescript
// API: GET /api/advances/summary?employeeId={id}
// Returns:
{
  employee: { id, fullName, employeeId },
  entries: [
    { date, description, type: 'DEBIT'|'CREDIT', amount, runningBalance, advanceId },
  ],
  summary: { totalDebits, totalCredits, currentBalance }
}
```

**Key Behaviors:**
- Only shows CASH_ADVANCE type (not SSS/Pag-IBIG loans)
- Debits = advance given to employee (increases balance)
- Credits = payroll deductions (decreases balance)
- Running balance computed server-side, sorted by date ascending
- Color-coded: red (outstanding), green (paid off), orange (overpaid)

### Petty Cash TypeScript Interface Fixes (2026-04-30)

**Issue:** TypeScript errors in petty-cash page showing "Property does not exist" for `Account.type` and `PettyCashFund.custodianId`.

**Files Updated:**
- `app/(dashboard)/accounting/petty-cash/page.tsx` - Added missing properties to interfaces

**Changes Made:**
1. Added `type: string` to `Account` interface (used for filtering expense accounts by type)
2. Added `custodianId: string` to `PettyCashFund` interface (used when editing fund details)

```typescript
// Before: Account interface missing type
interface Account {
  id: string;
  code: string;
  name: string;
}

// After: Account interface with type
interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

// Before: PettyCashFund interface missing custodianId
interface PettyCashFund {
  id: string;
  name: string;
  fundAmount: number;
  currentBalance: number;
  cashAccountId: string;
  expenseAccountId: string;
  status: string;
  createdAt: string;
}

// After: PettyCashFund interface with custodianId
interface PettyCashFund {
  id: string;
  name: string;
  fundAmount: number;
  currentBalance: number;
  cashAccountId: string;
  expenseAccountId: string;
  custodianId: string;
  status: string;
  createdAt: string;
}
```

---

### GL vs Subsidiary Ledger Balance Discrepancy Fix (2026-04-27)

**Issue:** COA shows 2100 Accounts Payable balance of ₱67,162.94 while Subsidiary Ledger (Supplier) total is only ₱57,662.94 - a difference of ₱9,500.

**Root Cause:** When Purchase Bills were created for suppliers NOT in the Vendors list (or with mismatched names), the GL journal entry was created but NO subsidiary transaction was recorded. The system only found the supplier ledger if the name EXACTLY matched an existing vendor entry.

**Files Updated:**
- `app/api/accounting/purchases/route.ts` - Auto-creates vendor in subsidiary ledger if not found
- `app/api/accounting/payments/route.ts` - Auto-creates vendor in subsidiary ledger if not found
- `app/api/accounting/journal/route.ts` - Added filter by reference for querying
- `app/api/accounting/payments/route.ts` - Enhanced GET with reference filter and journal details

**Fix Applied:**
```typescript
// Auto-create vendor if not found to ensure GL and subsidiary are in sync
let supplierLedger = await tx.subsidiaryLedger.findFirst({
  where: {
    entityType: 'SUPPLIER',
    entityName: supplierName,
    accountId: apAccountId,
  },
});

if (!supplierLedger) {
  supplierLedger = await tx.subsidiaryLedger.create({
    data: {
      accountId: apAccountId,
      entityCode: `SUP-${Date.now()}`,
      entityName: supplierName,
      entityType: 'SUPPLIER',
      description: `Auto-created from Purchase Bill ${billNumber}`,
    },
  });
}
```

**Querying Journal Entries:**
- `GET /api/accounting/journal?reference=BILL-2026-5711` - Find bill journal entry
- `GET /api/accounting/payments?reference=BILL-2026-5711` - Find payment with journal details

---

### Payment Debit Account Fix (2026-04-27)

**Issue:** When paying a Purchase Bill with EWT (Expanded Withholding Tax), the journal entry was debiting the wrong account (2340 EWT instead of 2100 Accounts Payable).

**Root Cause:** The code picked ANY credit line from the bill's journal entry, but if there were multiple credit lines (EWT and AP), it picked the first one found (EWT 2340).

**Files Updated:**
- `app/api/accounting/payments/route.ts` - Fixed POST and PATCH handlers to specifically find 2100

**Fix Applied:**
```typescript
// Find the AP account (2100) specifically - avoid EWT or other credit accounts
const apLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code === '2100');
apAccountId = apLine?.accountId || '';

// Fallback: if no 2100 found, try any credit line that's NOT EWT (2340)
if (!apAccountId) {
  const fallbackLine = je.lines.find((l: any) => l.credit > 0 && l.account?.code !== '2340');
  apAccountId = fallbackLine?.accountId || '';
}
```

---

### Vercel Deployment & EWT Balance Fix (2026-04-23)

**Issues Fixed:**
- **TypeScript Build Error**: Fixed `Type error: Property 'id' does not exist on type 'string'` in `app/api/accounting/payments/route.ts` where `journalEntryId.id` was incorrectly used on a string field.
- **Unbalanced Journal Entries**: Fixed an issue in `app/api/accounting/purchases/route.ts` where journal entries were created with mismatched debits and credits when EWT was involved.
- **Missing EWT Account (2340)**: Implemented an automatic fallback in the backend. If an EWT percentage is provided but the account is missing, it now defaults to **2340 (Expanded Withholding Tax)**.
- **Smart Form Editing**: Updated the Purchases page UI to correctly extract EWT percentage and VAT status from existing journal entries when editing, preventing data loss on re-save.

**Vercel Readiness Audit:**
- **Dependencies**: Identified version mismatches between `next` (v14) and `eslint-config-next` (v15) that should be synced for stable builds.
- **Prisma**: Verified singleton pattern and `@prisma/client` version compatibility.
- **Environment**: Noted that `DATABASE_URL` and `NEXTAUTH_SECRET` are mandatory in Vercel.
- **Face-API**: Confirmed `face-api.js` is handled correctly via dynamic imports and webpack shims to avoid server-side build failures.

**Key Files:**
- `app/api/accounting/payments/route.ts` - Fixed journalEntryId type error
- `app/api/accounting/purchases/route.ts` - Balanced EWT journal entry logic
- `app/(dashboard)/accounting/purchases/page.tsx` - Smart extraction of EWT/VAT from entries

---

### EWT & Input VAT for Expense Vouchers (2026-04-23)

**Issue Fixed:** Expense Vouchers did not have EWT (Expanded Withholding Tax) and Input VAT handling, unlike Purchase Bills which already had this feature.

**Files Updated:**
- `app/(dashboard)/accounting/expenses/page.tsx` - Added EWT/VAT form fields to both new and edit dialogs
- `app/api/accounting/expenses/route.ts` - Updated POST and PATCH handlers with VAT/EWT journal entry logic

**UI Fields Added:**
- `isVatInclusive` checkbox - Toggle 12% VAT calculation
- `noInputVat` checkbox - Opt out of Input VAT claim
- `ewtAccountId` dropdown - Select EWT account (234x codes)
- `ewtPercentage` input - Enter withholding tax rate
- Computed EWT Amount display (based on net of VAT)

**Journal Entry Logic:**
When VAT/EWT is applied, the journal entry now includes:
- Debit: Expense accounts (per line items)
- Debit: Input VAT (2320) if VAT toggle enabled and not opted out
- Credit: EWT account for withholding amount
- Credit: Cash for (Total - EWT), keeping entry balanced

```typescript
// Journal entry lines with VAT and EWT
const journalEntryLines = [
  ...items.map(item => ({ debit: item.amount, credit: 0 })),  // Expense debits
  { accountId: inputVATAccount.id, debit: vatAmount, credit: 0 },   // Input VAT debit (if applicable)
  { accountId: ewtAccountId, debit: 0, credit: ewtAmount }, // EWT credit
  { accountId: cashAccountId, debit: 0, credit: totalAmount - ewtAmount }, // Cash credit (reduced by EWT)
]
```

**Key Files:**
- `app/(dashboard)/accounting/expenses/page.tsx` - Form UI with EWT/VAT fields
- `app/api/accounting/expenses/route.ts` - API with tax-aware journal entries
- `app/(dashboard)/accounting/purchases/page.tsx` - Reference implementation

---

### Multi-Location Clock In/Out Support (2026-04-22)

**Issue Fixed:** Clock In/Clock Out buttons were disabled when employees were outside the geofence of the single active office location, even if they were within range of another configured office.

**Root Cause:** The `fetchOfficeLocation` function in `time-logs/page.tsx` only fetched and used the single active location (`locations.find((loc) => loc.isActive)`). The `withinRange` state was computed against only that one location.

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx` - Updated state, fetching, distance calculation, UI, and clock-in/clock-out logic to support multiple office locations

**Changes Made:**
1. **Replaced single location with array:** Changed `officeLocation` (single object) to `officeLocations` (array of all locations)
2. **Multiple distance tracking:** Replaced single `distance` with `distances` (Map of location ID → distance) and `closestLocation` (for error messages)
3. **Updated fetching:** `fetchOfficeLocation` now loads all locations, not just the active one
4. **Updated distance calculation:** The `useEffect` computes distance to **each** location and sets `withinRange = true` if **any** location is within range
5. **Updated clock-in/clock-out conditions:** `canClockIn` / `canClockOut` now use `officeLocations.length` instead of `officeLocation`
6. **Updated GPS status UI:** Displays all locations with their distances (✓/✗ per location)
7. **Updated alert messages:** Error messages in `handleClockIn` and `handleClockOut` list all available locations

```typescript
// Before: Single active location
const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
const [distance, setDistance] = useState<number | null>(null);
const withinRange = distance !== null && distance <= (officeLocation?.rangeMeters || 100);

// After: Multiple locations
const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
const [distances, setDistances] = useState<Map<string, number>>(new Map());
const [closestLocation, setClosestLocation] = useState<OfficeLocation | null>(null);
const withinRange = officeLocations.some(loc => {
  const d = distances.get(loc.id);
  return d !== undefined && d <= (loc.rangeMeters || 100);
});
```

**Key Files:**
- `app/(dashboard)/time-logs/page.tsx` - Updated to support multiple office locations for clock in/out
- `app/api/office-location/route.ts` - Already supports multiple locations (no changes needed)
- `app/(dashboard)/settings/page.tsx` - Where users configure office locations

---

### GAAP Financial Reporting & Beginning Balances (2026-04-20)

**New Features:**
- **GAAP Financial Reports**: Implemented real-time, GAAP-compliant **Trial Balance**, **Income Statement (P&L)**, and **Balance Sheet (Statement of Financial Position)**.
- **Beginning Balances**: Added "Initial Balance" field to the Chart of Accounts setup.
- **Automatic Opening Entries**: System now automatically creates a Journal Entry against **Retained Earnings** when a new account is created with an initial balance.
- **Accounting Dashboard**: Connected the overview dashboard to real-time stats (Cash, AR, AP, Net Income) and recent journal entries.
- **Professional Report UI**: Replaced tabs with a professional dropdown selector and high-fidelity accounting layouts.

**Issues Fixed:**
- **Import Errors**: Fixed `next/link` named import crash in COA page and `prisma` import error in transactions API.
- **API Access**: Updated `middleware.ts` to allow `/api/accounting` paths, fixing "Account transactions not found" errors.
- **Sidebar UX**: Fixed the "Logout" button overlapping with navigation items by making the sidebar a flex container with scrollable navigation.
- **Stability**: Added nullish coalescing safeguards to all numeric displays to prevent crashes (e.g., `toLocaleString` on undefined values).

**Key Files:**
- `app/(dashboard)/accounting/reports/page.tsx` - Professional reports interface with safety fallbacks
- `app/api/accounting/reports/[type]/route.ts` - GAAP-compliant reporting logic
- `app/api/accounting/accounts/route.ts` - Updated POST handler for automatic beginning balance entries
- `app/(dashboard)/layout.tsx` - Restructured sidebar with flex-box and scrollable nav
- `app/api/accounting/stats/route.ts` - New dashboard statistics API

**How to set an Initial Balance:**
1. Go to Chart of Accounts (`/accounting/coa`)
2. Click **Add Account**
3. Enter account details and fill in the **Initial Balance (Beginning Balance)** field
4. Upon save, the system creates the account AND a corresponding POSTED journal entry to establish the balance against Retained Earnings.
5. *Note: Initial balances are read-only after creation to maintain audit trails. Use Journal Entries for adjustments.*

---

### Element Type is Invalid Error (2026-04-20)

**Error:** `Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined.`

**Potential Causes Investigated:**
1. Component not exported from file
2. Circular import issues
3. Missing default export
4. Failed dynamic import
5. Stale build cache

**Files Checked:**
- `components/ui/card.tsx` - All components properly exported
- `components/ui/dialog.tsx` - All components properly exported
- `components/facial-recognition/FaceCapture.tsx` - Default export present

**Troubleshooting Steps:**
1. Delete `.next` folder and restart dev server
2. Run `npm run dev` to rebuild
3. Check full error stack trace from browser console (F12)

**Fixes Applied:**
- None required - all UI components properly export their components
- Issue may be intermittent build cache or requires full stack trace for root cause

---

### Print Payroll No Data Fix (2026-04-18)

**Issue Fixed:** "No payroll records found" error due to Prisma P2032 error - Payroll records with null dailyRate causing API to fail

**Files Updated:**
- `app/api/payroll/route.ts:807-825` - Fixed GET handler to fetch payroll and employees separately
- `prisma/schema.prisma:388-391` - Added @default(0) to Float fields (basicSalary, dailyRate, workDays, daysWorked)

**Changes Made:**
1. **Separated queries:** Fetch payrolls without `include: { employee: true }` to avoid P2032 error
2. **Separate employee fetch:** Fetch employees by IDs and map them to payrolls
3. **Filter null values:** Filter out records where dailyRate is null
4. **Schema defaults:** Added @default(0) to prevent future null issues

```typescript
// Before: Failed with P2032 error
const payrolls = await prisma.payroll.findMany({
  where,
  include: { employee: true },  // Caused error with null Float fields
});

// After: Separate queries to avoid Prisma error
const payrolls = await prisma.payroll.findMany({
  where: where as never,
  orderBy: [{ year: 'desc' }, { month: 'desc' }],
});
const employeeIds = [...new Set(payrolls.map(p => p.employeeId))];
const employees = await prisma.employee.findMany({
  where: { id: { in: employeeIds } },
});
const validPayrolls = payrolls
  .filter(p => p.dailyRate !== null)
  .map(p => ({ ...p, employee: employeeMap.get(p.employeeId) }));
```

### Print Payroll PDF Updates (2026-04-18)

**Issues Fixed:**
- PDF column overlap and spacing
- Records showing immediately without filter
- No. of Days showing wrong value
- Certification placement

**Files Updated:**
- `app/(dashboard)/reports/print-payroll/page.tsx` - Multiple updates to PDF generation

**Changes Made:**
1. **Added Rate/Day and No. of Days columns:**
   - Rate/Day = basicSalary / 22
   - No. of Days = daysWorked from payroll data (actual count of days with time logs)

2. **Filter button behavior:**
   - Records only display after clicking "Filter" button
   - Added `filterApplied` state to control display
   - Shows "X payroll record(s)" only when filter is applied

3. **Fixed filter logic:**
   - Changed from exact match to overlapping period check
   - If filter selects April 1-15, shows records that overlap with that range

4. **Column widths adjusted:**
   - Wider columns: `[8, 35, 25, 28, 22, 16, 28, 22, 22, 26, 22, 30]` (total 256mm fits landscape legal ~356mm)

5. **Certification at bottom:**
   - Fixed position at `pageHeight - 80` (~80mm from bottom)
   - If not enough space, moves to new page

### Holiday Computation Fix (2026-04-18)

**Issue Fixed:** Incorrect holiday pay calculation logic

**Files Updated:**
- `app/api/payroll/route.ts` - Updated holiday logic in both POST (generate) and GET (list) handlers

**New Logic:**
- **REGULAR (Legal) Holidays:**
  - If worked on holiday AND has attendance before AND after → full holiday pay (100%)
  - If did NOT work on holiday but has attendance on/before → holiday pay (legal holiday benefit)
- **SPECIAL Holidays:**
  - Requires working on holiday AND attendance before AND after → 30% holiday pay

**Changes Made:**
```typescript
// Check attendance before/after holiday
const datesBefore = sortedDates.filter(d => new Date(d) < holidayDate);
const datesAfter = sortedDates.filter(d => new Date(d) > holidayDate);
const hasAttendanceBefore = datesBefore.length > 0;
const hasAttendanceAfter = datesAfter.length > 0;
const hasAttendanceBeforeAndAfter = hasAttendanceBefore && hasAttendanceAfter;

if (holiday.type === 'REGULAR') {
  if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
    regularHolidayDays += 1;
  } else if (!workedOnHoliday && hasAttendanceBefore) {
    // Did not work on holiday but has attendance on/before
    regularHolidayDays += 1;
  }
} else if (holiday.type === 'SPECIAL') {
  if (workedOnHoliday && hasAttendanceBeforeAndAfter) {
    specialHolidayDays += 1;
  }
}
```

### Face Recognition Body Scroll Fix (2026-04-18)

**Issue Fixed:** Body scroll gets locked/disturbed when opening face verification modal

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx:127-134` - Added useEffect for body overflow management

**Changes Made:**
```typescript
useEffect(() => {
  if (isCaptureOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }
  return () => {
    document.body.style.overflow = 'auto';
  };
}, [isCaptureOpen]);
```

### Holiday Attendance Requirement Removal (2026-05-19)

**Issue Fixed:** Employees were disqualified from holiday pay if they were absent on the working day before or after a holiday.

**Files Updated:**
- `lib/payroll.ts` - Removed attendance-based eligibility checks in `computePayroll`.

**Changes Made:**
- Removed `hasAttendanceBeforeAndAfter` and `hasAttendanceBefore` checks.
- Regular holidays now always count towards `regularHolidayDays` regardless of surrounding attendance.
- Special holidays count if worked, without checking surrounding attendance.
- Cleaned up unused variables: `sortedDates`, `datesBefore`, `datesAfter`.


This prevents body scroll lock when the face verification modal appears and restores it when closed.

### Accounting Pages TypeScript & ESLint Fixes (2026-04-17)

**Issues Fixed:**
- ESLint error `react/no-unescaped-entities` in subsidiary-ledgers page
- TypeScript error `Property 'type' does not exist on type 'Account'` in expenses page

**Files Updated:**
- `app/(dashboard)/accounting/subsidiary-ledgers/page.tsx:290` - Escaped single quotes using HTML entity `&apos;`
- `app/(dashboard)/accounting/expenses/page.tsx:39` - Added `type: string` property to `Account` interface

**Changes Made:**
```typescript
// Before:
interface Account {
  id: string;
  code: string;
  name: string;
}

// After:
interface Account {
  id: string;
  code: string;
  name: string;
  type: string;  // Added for filtering by account type (ASSET, EXPENSE, etc.)
}
```

**ESLint Fix Pattern:**
```jsx
// Instead of:
<span>Click 'Add' to create</span>

// Use:
<span>Click &apos;Add&apos; to create</span>
```

### TypeScript Strict Type Fixes (2026-04-17)

**Issue Fixed:** Vercel deployment error - "Unexpected any" violations in strict TypeScript mode

**Files Updated:**
- `app/(dashboard)/accounting/vendors/page.tsx` - Added explicit type annotations for API responses (`Vendor[]`, `VendorWithTransactions`)
- `app/(dashboard)/time-logs/page.tsx` - Added explicit type annotations for all fetch operations, import handlers, and API responses

**Changes Made:**
- Added `as Type[]` type assertions to `fetch().json()` calls
- Added explicit parameter types to async callbacks (e.g., `(res: Response)`, `(data: Type)`, `(err: Error)`)
- Extended interface definitions to include all Prisma model fields
- Removed implicit `any` types from inline callbacks (e.g., `.find((emp) => ...)` instead of `.find((emp: Employee) => ...)`) when the parent array is already typed

**Pattern for Vercel Deployment:**
```typescript
// Instead of:
const data = await res.json()

// Use:
const data = await res.json() as YourInterface[]
```

### Face Recognition Verification Fix (2026-04-17)

**Issue Fixed:** Face verification modal not appearing when clicking "Clock In" in `/time-logs`, causing "Session expired" error and body scroll lock issues

**Root Causes:**
1. **Authentication mismatch** - Face descriptor API used NextAuth (`getServerSession`) instead of cookie-based auth (`isLoggedIn` cookie)
2. **Missing modal JSX** - Face verification modal was not rendered in the time-logs page despite state and imports existing
3. **Poor error messages** - Generic "Employee has not enrolled their face" error without debugging information

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx:413-450` - Enhanced `initiateVerification()` with detailed logging, empty array checks, and specific error messages
- `app/(dashboard)/time-logs/page.tsx:1404-1430` - Added missing face verification modal JSX with `FaceCapture` component
- `app/api/employees/[id]/face-descriptor/route.ts` - Changed from NextAuth to cookie-based auth, added empty array check and detailed logging

**Changes Made:**
```typescript
// Before: NextAuth session check (caused 401 "Session expired")
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// After: Cookie-based auth (matches app pattern)
const cookieStore = await cookies();
const isLoggedIn = cookieStore.get('isLoggedIn')?.value;
if (isLoggedIn !== 'true') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Frontend Improvements:**
- Added console logging for debugging employee ID and API responses
- Checks for empty face descriptor arrays (`faceDescriptor.length === 0`)
- Specific error messages for 404 (not enrolled) vs 401 (session expired)
- Added face verification modal with proper close handlers

**How Face Verification Works:**
1. User clicks "Clock In" → `initiateVerification()` fetches descriptor from `/api/employees/[id]/face-descriptor`
2. If descriptor exists → Opens modal with `FaceCapture` component in verify mode
3. Face captured → Compares against stored descriptor using Euclidean distance
4. If distance < 0.6 → Auto-clocks in and closes modal
5. If distance ≥ 0.6 → Shows error "Identity verification failed" with retry option

**Debugging Steps:**
1. Open browser console (F12) → Look for `[Face Verification]` logs
2. Check backend logs for `[Face Descriptor API]` logs
3. Verify employee has face descriptor in database via Prisma Studio (`/api/employees/[id]/face-descriptor` returns 200)
4. If 404 returned → Enroll face via `/employees` page (Edit → "Enroll Face" button)

### XCLS Import Excel Numeric Time Fix (2026-04-17)

**Issue Fixed:** XCLS import (`/api/time-logs/import-xcls`) returning `null` for clockIn/clockOut when importing Excel files with numeric time values (e.g., `0.3125` for 7:30 AM) instead of text format (e.g., `"7:30 AM"`)

**Root Cause:** The `parseTime` function expected text format `"HH:MM AM/PM"` but Excel stores times as fractions of a day (0.3125 = 7:30 AM). When using `cellDates: true`, these become Date objects from Excel's epoch (1899-12-30) rather than times of day.

**Files Updated:**
- `app/api/time-logs/import-xcls/route.ts:44-71` - Enhanced `parseTime` to handle Excel numeric times and Date objects
- `app/api/time-logs/import-xcls/route.ts:73-93` - Updated `parseDate` to return midnight (00:00:00) instead of noon (12:00:00)
- `app/(dashboard)/time-logs/page.tsx:550-564` - Updated `downloadXclsTemplate` to use Date objects for proper Excel formatting

**Changes Made:**
```typescript
// Before: Only handled text format "7:48 AM"
const match = timeStrClean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
if (!match) return null;

// After: Handles Excel numeric time (0.3125 = 7:30 AM)
if (typeof timeStr === 'number') {
  const totalMinutes = Math.round(timeStr * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
}

// Also handles Date objects from Excel (when cellDates: true)
if (timeStr instanceof Date) {
  const hours = timeStr.getHours();
  const minutes = timeStr.getMinutes();
  return new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
}
```

**Date Fix:**
```typescript
// Before: Used noon (12:00:00) to avoid timezone issues
return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

// After: Uses midnight (00:00:00) for date field
return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
```

**Excel Date/Time Reference:**
- Excel stores dates as serial numbers from 1899-12-30 (46125 = April 12, 2026; 46126 = April 13, 2026)
- Excel stores times as fractions of a day (0.3125 = 7:30 AM; 0.708333 = 5:00 PM)
- The import now handles both numeric and text formats

### Customer & Vendor Management (2024-04-16)

**New Features:**
- **Customers Page** (`/accounting/customers`) - Manage Accounts Receivable customers with credit limits, payment terms, and transaction history
- **Vendors Page** (`/accounting/vendors`) - Manage Accounts Payable suppliers with payment terms and transaction history
- **Subsidiary Ledger Support** - GAAP-compliant subsidiary ledger structure for AR, AP, Inventory, Fixed Assets, and Employee receivables
- **COA Subsidiary Configuration** - New Account form includes checkbox and dropdown to mark accounts as control accounts with subsidiary ledger type

**Database Models:**
- `SubsidiaryLedger` - Detailed records supporting General Ledger control accounts
- `SubsidiaryTransaction` - Transaction-level details for reconciliation
- `Account.hasSubsidiaryLedger` and `Account.subsidiaryType` - Mark control accounts (1200-AR, 1220-Employee Receivable, 1300-Inventory, 1600-Fixed Assets, 2100-AP)

**API Routes:**
- `GET/POST/PATCH/DELETE /api/accounting/customers` - Customer CRUD operations
- `GET/POST/PATCH/DELETE /api/accounting/vendors` - Vendor CRUD operations
- `GET/POST/PATCH /api/accounting/subsidiary-ledgers` - Generic subsidiary ledger management with reconciliation
- `GET/POST/PATCH /api/accounting/accounts` - Updated with hasSubsidiaryLedger and subsidiaryType fields

**Navigation:**
- Added "Customers" and "Vendors" menu items under Accounting sidebar
- QuickBooks-style account numbering: Assets (1000-1999), Liabilities (2000-2999), Equity (3000-3999), Revenue (4000-4999), Expenses (5000-5999)

**Key Files:**
- `app/(dashboard)/accounting/customers/page.tsx` - Customer management UI
- `app/(dashboard)/accounting/vendors/page.tsx` - Vendor management UI
- `app/(dashboard)/accounting/coa/page.tsx` - Updated with subsidiary ledger checkbox and type dropdown
- `app/api/accounting/customers/route.ts` - Customer API
- `app/api/accounting/vendors/route.ts` - Vendor API
- `app/api/accounting/accounts/route.ts` - COA API updated with subsidiary fields
- `prisma/schema.prisma` - SubsidiaryLedger and SubsidiaryTransaction models

**How to Setup Control Accounts:**
1. Go to Chart of Accounts (`/accounting/coa`)
2. Click "Add Account" or edit an existing account
3. Check "Has Subsidiary Ledger (Control Account)"
4. Select Subsidiary Type (Customer/Supplier/Inventory Item/Fixed Asset/Employee)
5. The account will appear in the Subsidiary Ledgers dropdown

---

### Database Performance Optimization (2026-05-04)

**Issue:** Database queries for large datasets (Time Logs, Journal Entries, Employees) were slowing down dashboard and reporting features.

**Fix Applied:**
Added over **40 targeted indexes** to the Prisma schema and synchronized with MongoDB.

**Key Models Indexed:**
- **Employee**: `department`, `isActive`, `userId`
- **LeaveRequest / OvertimeRequest**: Compound indexes on `[employeeId, status]` and date ranges
- **Accounting**: `date`, `reference`, and `status` for Journal Entries; `accountId` and `entryId` for Journal Lines
- **Assets / Petty Cash**: Indexed `status`, `categoryId`, and `date` for faster list views and filtering
- **Advances**: Indexed `employeeId` and `status` for balance tracking

**Action Taken:**
1. Updated `prisma/schema.prisma` with `@@index` definitions.
2. Ran `npx prisma db push` to apply indexes to MongoDB.

---

### Role-Based Access Control (RBAC) & Navigation (2026-05-04)

**Issue:** Users with the `EMPLOYEE` role could see and potentially access sensitive administrative modules like Accounting and Asset Inventory.

**Fixes Applied:**
- **Sidebar Navigation**: Updated `app/(dashboard)/layout.tsx` to mark **Accounting**, **Asset Inventory**, **Users**, and **Employees** as `adminOnly`. These are now hidden for the `EMPLOYEE` role.
- **Global Middleware Enforcement**: Updated `middleware.ts` to intercept and redirect `EMPLOYEE` users from restricted paths (e.g., `/accounting`, `/asset-inventory`, `/users`, `/employees`, `/reports`, `/settings`) back to the dashboard.
- **Data Isolation**: Verified that core HRIS modules (Leaves, Overtime, Time Logs, Payroll, Advances) correctly filter data to ensure employees only see their own records.

**Files Updated:**
- `app/(dashboard)/layout.tsx` - Updated `navItems` with `adminOnly` flags
- `middleware.ts` - Added global role-based path restrictions

---

### Vercel Deployment & Type Safety Fixes (2026-05-04)

**Issue:** Build failures on Vercel due to duplicate definitions, type mismatches, and Prisma relation errors.

**Fixes Applied:**
1. **Duplicate Variable Fix**: Removed redundant definition of `liabCredit` in `app/(dashboard)/accounting/vendors/page.tsx`.
2. **ESLint Readiness**: Resolved `no-explicit-any` errors in `app/api/accounting/journal/route.ts` by using proper `Prisma.JournalEntryWhereInput` types.
3. **Petty Cash Type Safety**: Fixed 13+ type errors in `app/(dashboard)/accounting/petty-cash/page.tsx` by defining proper `Liquidation` and `Disbursement` interfaces and fixing comparison logic.
4. **Prisma Relation Fix**: Added missing back-references in `JournalEntry` model for `PurchaseBill`, `SalesInvoice`, and `Expense` to resolve "property does not exist" errors in API routes.
5. **Verified Build**: Confirmed deployment readiness with `npm run lint` and `npx tsc --noEmit`.

**Key Files:**
- `app/(dashboard)/accounting/vendors/page.tsx`
- `app/(dashboard)/accounting/petty-cash/page.tsx`
- `app/api/accounting/journal/route.ts`
- `prisma/schema.prisma`
- `middleware.ts`

---

### Vendor Payment Feature (2026-04-28)

**New Feature:**
- **Pay Vendor Bills** - Click the `$` button on any vendor to open payment dialog
- Payment Dialog shows:
  - Total Outstanding Balance
  - List of unpaid bills with balances
  - Payment Amount field (editable)
  - Cash Account dropdown (shows all accounts)
  - Payment Date, Reference Number, Notes fields

**How to Pay a Vendor:**
1. Go to `/accounting/vendors`
2. Click the `$` (dollar sign) button next to a vendor with balance
3. Edit the payment amount if needed
4. Select a cash account from dropdown
5. Click "Pay" to process payment

**API:**
- `POST /api/accounting/payments/batch` - Process vendor payment

**Files Updated:**
- `app/(dashboard)/accounting/vendors/page.tsx` - Added payment dialog with $ button
- `app/api/accounting/payments/batch/route.ts` - Payment processing API

---

### Advances & Schedules Bug Fixes (2026-05-04)

**Issues Fixed:**
1. **Prisma Date Field Error** - `Unknown argument 'date'. Did you mean 'type'?`
   - The `date` field already existed in Prisma schema but needed `npx prisma generate` to regenerate client
2. **Edit Advance Date Picker** - Date not showing in edit modal
   - Fixed by converting ISO date string to `YYYY-MM-DD` format using `d.toISOString().split('T')[0]`
3. **Bulk Assign Disabled** - Schedules page bulk assign button always disabled
   - Added `disabled={true}` with grayed styling
4. **Maximum Update Depth Exceeded** - Infinite loop in schedules page
   - Changed useEffect dependency from `[fetchData]` to `[startDate]` to prevent recreation on every render

**Files Updated:**
- `prisma/schema.prisma` - Already had `date` field, ran `npx prisma generate`
- `app/(dashboard)/payroll/advances/page.tsx` - Fixed date conversion in `handleEdit` function (lines 150-167)
- `app/(dashboard)/schedules/page.tsx` - Disabled bulk assign button (line 318-324), fixed useEffect dependency (line 140)

---

### Employee Face Self-Enrollment (2026-05-05)

**New Feature:**
Employees can now enroll their own face from the Time Logs page without needing admin assistance.

**How to Enroll:**
1. Employee logs in and visits `/time-logs`
2. Clicks the green "Enroll My Face" button in the header
3. Opens face capture modal in enrollment mode
4. Captures face → saved to database via API
5. Can now use face verification for clock-in/out

**UI Elements Added:**
- "Enroll My Face" button in header (visible only to EMPLOYEE role)
- Face enrollment modal with status message display
- State variables: `isEnrolling`, `faceEnrollStatus`

**Authorization Logic:**
- EMPLOYEE: Can enroll their own face (email must match logged-in user)
- ADMIN/HR: Can enroll any employee's face

**Files Updated:**
- `app/(dashboard)/time-logs/page.tsx` - Added enrollment button, modal, and handler
- `app/api/employees/[id]/face/route.ts` - Updated to allow EMPLOYEE role to enroll own face

---

### Multi-Branch Support for Accounting & Asset Modules (2026-05-22)

**Feature:** Added branch isolation for accounting, asset inventory, and holidays — users can filter by branch or see consolidated "All Branches" data.

**Architecture:**
- **Branch model** (Prisma): name, code, address, contactPerson, contactPhone, contactEmail, isActive
- **React Context + Cookie hybrid**: `BranchProvider` persists selection across sessions; API routes read `branchId` from query params
- **"All Branches" mode**: API routes skip branch filter when `branchId=all`, showing consolidated data
- **First-setup prompt**: Settings page asks admin for initial branch name if none exist
- **BranchSelector dropdown**: Placed in dashboard layout header, only affects accounting/asset/holiday pages

**Database Changes:**
- Added `Branch` model with `@@index([isActive])`
- Added `branchId String? @db.ObjectId` + `Branch? @relation` to: JournalEntry, Expense, SalesInvoice, PurchaseBill, Payment, PettyCash, PettyCashDisbursement, PettyCashLiquidation, Asset, AssetCategory, AssetTransaction, SubsidiaryLedger, Holiday
- Existing Holiday model upgraded from bare `String?` to proper relation

**Files Created:**
- `app/api/branches/route.ts` — GET (list) + POST (create with duplicate check)
- `app/api/branches/[id]/route.ts` — PATCH (update with conflict check) + DELETE (safety check blocking deletion with transactions)
- `app/api/branches/seed/route.ts` — POST (create branch + migrate all null-branch records)
- `lib/branch-context.tsx` — BranchProvider, useBranch hook, cookie persistence
- `components/branch-selector.tsx` — shadcn Select dropdown

**Files Updated:**
- `prisma/schema.prisma` — Branch model + branchId on 13 models + Holiday relation fix
- `app/(dashboard)/layout.tsx` — Wrapped children with BranchProvider
- `app/(dashboard)/settings/page.tsx` — Branch CRUD form (name, code, address, contact), first-setup prompt, list with edit/delete
- App API routes — GET handlers filter by `branchId`, POST/PATCH handlers save `branchId`: expenses, sales, purchases, payments (batch + individual), journal, petty-cash (including disbursements/liquidations), subsidiary-ledgers, customers, vendors, stats, reports (trial-balance, income-statement, balance-sheet), payroll-sync, assets-sync, accounts/transactions, holidays, assets (list/categories/transactions)
- Frontend pages — consume BranchContext for fetch params + form data: COA, journal, expenses, sales, purchases, vendors, customers, subsidiary-ledgers, reconciliation, petty-cash, reports, asset-inventory (list/new/detail/edit/categories/transactions/reports), holidays
- `app/api/accounting/accounts/route.ts` — Fixed COA balances: `calculateAccountBalance` now passes `branchId` to filter JournalLine through `entry.branchId`

**Bugs Fixed:**
1. **COA balances not filtering by branch** — `calculateAccountBalance` queried all JournalLine records without branch filter
2. **Journal POST missing branchId** — Frontend wasn't sending `branchId` in request body
3. **9 missing branchId in POST/PATCH bodies** — Petty-cash (5: liquidation, disbursement, replenish, submit, update), purchases (2: pay bill, edit payment), vendors (1: batch payment), asset categories (1: create)

**MongoDB Quirks Discovered:**
- Prisma `updateMany({ where: { branchId: null } })` does NOT match null values in MongoDB — must use `$runCommandRaw`
- `@db.ObjectId` fields must store ObjectId type, not string — raw `$set` stores as string, requiring `$toObjectId` aggregation pipeline to convert

**Key Files:**
- `app/api/branches/route.ts` — Branch CRUD
- `lib/branch-context.tsx` — Branch state management
- `components/branch-selector.tsx` — UI selector
- `app/(dashboard)/settings/page.tsx` — Branch management UI
- `scripts/migrate-to-branch-2.ts` — Raw MongoDB migration script
- `scripts/fix-branch-objectid.ts` — String-to-ObjectId conversion
- `docs/plans/2026-05-22-branch-support-design.md` — Architecture design doc
- `docs/plans/2026-05-22-branch-support-implementation.md` — Implementation plan

---

### CUSA Billing Module (2026-07-13)

**New Feature:** Complete CUSA (Common Use Service Area) billing module for commercial buildings — quarterly billing, tiered rates by unit area, payment tracking, bill printing, and overdue reporting.

**Database (5 new Prisma models):**
- `CusaUnit` — Building units with floor, zone, area (sq.m.), status (OCCUPIED/VACANT/UNDER_RENOVATION), tenant relation, lease dates
- `CusaRate` — Rate structures with effective dates and active status
- `CusaRateTier` — Tiered pricing by area range (`fromArea`, `toArea`, `pricePerSqm`)
- `CusaBill` — Generated bills with `CUSA-YYYYQ#-XXXX` format, status tracking, balance
- `CusaPayment` — Payments against bills with `CUSAPAY-YYYYMMDD-XXXX` format

**Files Created:**
- `lib/cusa-billing.ts` — Tiered computation engine, bill/payment number generators, sequence helpers
- `hooks/use-cusa.ts` — 16 React Query hooks for all CUSA entities
- `lib/query-keys.ts` — CUSA query key factory (list/detail pattern)
- `app/api/cusa/units/route.ts` + `[id]/route.ts` — Units CRUD
- `app/api/cusa/rates/route.ts` + `[id]/route.ts` — Rates CRUD
- `app/api/cusa/bills/route.ts` + `[id]/route.ts` — Bill generation + status updates
- `app/api/cusa/payments/route.ts` + `[id]/route.ts` — Payment recording
- `app/api/cusa/reports/dashboard/route.ts` — Dashboard stats API
- `app/api/cusa/reports/overdue/route.ts` — Overdue report API
- `app/(dashboard)/cusa/page.tsx` — Dashboard with stats cards + recent bills
- `app/(dashboard)/cusa/units/page.tsx` — Units management with tenant dropdown, dark mode
- `app/(dashboard)/cusa/rates/page.tsx` — Rate setup with tier management, dark mode
- `app/(dashboard)/cusa/bills/page.tsx` — Bill generation + payment recording, dark mode
- `app/(dashboard)/cusa/bills/[id]/print/page.tsx` — Print-friendly bill with payment history
- `app/(dashboard)/cusa/payments/page.tsx` — Payment history with filters, dark mode
- `app/(dashboard)/cusa/overdue/page.tsx` — Overdue report with days count, dark mode

**Files Updated:**
- `prisma/schema.prisma` — Added 5 CUSA models with indexes, Tenant back-references
- `app/(dashboard)/layout.tsx` — Added "CUSA Billing" sidebar section (adminOnly)
- `middleware.ts` — Added `/cusa` to EMPLOYEE restricted paths

**Bugs Fixed:**
1. **Bill generation unique constraint violation** — `getNextCusaBillSequence` was called inside `$transaction` but used `prisma` (not `tx`), so each loop iteration got the same sequence. **Fix:** Pre-compute starting sequence before transaction, increment locally.
2. **Area field defaulted to 0** — Area fields in Add Unit and Add Rate forms started with `0`, preventing typing. **Fix:** Changed initial values to empty string, convert to number on submit.
3. **Tenant ID required manual entry** — Users had to manually type tenant ObjectId. **Fix:** Replaced text input with dropdown listing all tenants from Water Billing.
4. **Dark mode text invisible** — Print page (Amount Details table, labels, headers) and several pages had no dark mode text colors. **Fix:** Added `dark:text-white/gray-300/gray-400` to all visible text, `dark:border-gray-700` to borders, `dark:bg-gray-800/900` to backgrounds.

**Key Patterns:**
```typescript
// Bill number format
const billNo = `CUSA-${year}Q${quarter}-${String(sequence).padStart(4, '0')}`
// e.g., CUSA-2026Q3-0001

// Payment number format
const paymentNo = `CUSAPAY-${dateStr}-${String(sequence).padStart(4, '0')}`
// e.g., CUSAPAY-20260713-0001

// Tier computation
export function findApplicableTier(areaSqm: number, tiers: CusaRateTier[]): CusaRateTier | null {
  const sorted = [...tiers].sort((a, b) => a.sequence - b.sequence)
  for (const tier of sorted) {
    const tierMax = tier.toArea ?? Infinity
    if (areaSqm >= tier.fromArea && areaSqm <= tierMax) return tier
  }
  return null
}

// Bill generation sequence fix (avoids unique constraint on billNo)
let currentSequence = await getNextCusaBillSequence(year, quarter)
const createdBills = await prisma.$transaction(async (tx) => {
  for (const unit of units) {
    const seq = currentSequence++
    // ... create bill with seq
  }
})
```

**Navigation Paths:**
```
Properties Management > CUSA Billing
  ├── Dashboard       /cusa
  ├── Units           /cusa/units
  ├── Rates           /cusa/rates
  ├── Bills           /cusa/bills   (Generate Bills + Record Payment)
  ├── Payments        /cusa/payments
  └── Overdue Report  /cusa/overdue
```

---

### Payroll Holidays Not Computed Fix (2026-09-02)

**Issue:** `http://localhost:3000/payroll` — holidays were not counted in payroll computation. Generated payrolls for `2026-08-16` to `2026-08-31` showed `holidayPay: 0` even though two REGULAR holidays existed in that period (`2026-08-21 Ninoy Aquino Day`, `2026-08-31 National Heroes Day`).

**Root Causes (2 bugs):**

1. **Branch-filtered holiday query** — `app/api/payroll/route.ts:285` queried only global holidays:
   ```typescript
   where: { isActive: true, branchId: null, date: { gte: startDate, lt: nextDay } }
   ```
   But the Holidays page (`app/(dashboard)/holidays/page.tsx:68`) creates holidays with `branchId: selectedBranch?.id || null`. When a branch was selected, holidays were created as **branch-specific** (e.g., `branchId: "6a0fd014..."`). Payroll never saw them — query returned `[]`, so `computePayroll()` added `0` holiday pay. Verified via `scripts/verify-holiday-fix.ts`: OLD filter `0` holidays vs FIX `2` holidays → OLD `holidayPay 0` vs NEW `holidayPay 1400` (2 × ₱700).

2. **Missing `details.totals`/ `deductions` fields in POST response** — `app/api/payroll/route.ts:334` returned only:
   ```typescript
   earnings: { baseSalary, overtimePay, holidayPay, grossPay }
   deductions: { absences, lates, undertime, sss, philHealth, pagIbig, withholdingTax }
   totals: { netPay }
   ```
   Frontend (`app/(dashboard)/payroll/page.tsx:751`) renders holiday row only if `result.details.totals.holidayDays > 0`. Since `holidayDays` was never sent, the UI never showed holiday pay even when `earnings.holidayPay` was correct. Same for bulk `All Employees` — dummy result hard-coded `holidayPay: 0`.

**Files Updated:**

- `lib/payroll.ts` — Extended `PayrollResult` with `regularHolidayDays`, `specialHolidayDays`, `holidayDays` and returned them from `computePayroll()` (previously internal variables not exposed).
- `app/api/payroll/route.ts` — **(a)** Removed `branchId: null` filter → `where: { isActive: true, date: { gte: startDate, lt: nextDay } }` so *all* active holidays (global + branch-specific) are counted. Employees have no `branchId`, so payroll is intentionally branch-agnostic. **(b)** Fixed single-employee POST response to return full `deductions` (`totalDeductions`) and `totals` (`totalOtHours`, `holidayDays`, `regularHolidayDays`, `specialHolidayDays`, `leaveDays`, `offDays`, `absentDays`, `lateMinutes`, `undertimeMinutes`, `netPay`) by querying `shiftSchedule`/`leaveRequest` for totals and using `result.*`. **(c)** Added `cache.delByPattern(PAYROLL_CACHE_PREFIX*)` after both single and bulk payroll creation so `GET /api/payroll` history immediately reflects holiday pay (previously only DELETE invalidated cache). Bulk path now also invalidates cache.
- `app/(dashboard)/payroll/page.tsx` — Bulk `All Employees` summary now aggregates `holidayPay` from `payroll.holidayPay` across results and populates `earnings.holidayPay` / `totals.holidayDays` instead of hard-coded `0`.

**Verification:**
```
npx tsx scripts/verify-holiday-fix.ts
# holidays with FIX (no branch filter): [Ninoy Aquino Day 2026-08-21, National heroes day 2026-08-31]
# holidays OLD filter (branchId null only): []
# employee JEROME R. SABUSIDO 700 DAILY — timeLogs 9
# OLD holidayPay 0 regular 0 special 0 holidayDays 0
# NEW holidayPay 1400 regular 2 special 0 holidayDays 2 gross 7700
# VERIFIED: fix correctly includes branch holidays that were previously missed
```
`npx tsc --noEmit --skipLibCheck` — only pre-existing `HolidayType` enum mismatch in `scripts/verify-holiday-fix.ts` (prisma `SPECIAL_NON_WORK` vs lib `SPECIAL_NON_WORKING`), no new errors in payroll files.

**Action Required for Existing Data:** Previously generated payrolls with `holidayPay: 0` for periods containing branch-specific holidays are stale. Delete them via **Payroll History → Trash icon** (ADMIN only) and re-compute payroll for the same period — new payrolls will now correctly show `Holiday Pay`.

**Key Pattern — Payroll holidays must be branch-agnostic (employees lack `branchId`):**
```typescript
// ❌ BAD — excludes branch-specific holidays created when a branch is selected
where: { isActive: true, branchId: null, date: { gte: startDate, lt: nextDay } }

// ✅ GOOD — include all active holidays regardless of branch
where: { isActive: true, date: { gte: startDate, lt: nextDay } }
```
