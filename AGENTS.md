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
