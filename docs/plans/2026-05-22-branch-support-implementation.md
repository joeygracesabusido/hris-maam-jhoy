# Multi-Branch Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add branch-level data isolation to accounting and asset inventory modules with a BranchProvider context, branch CRUD in settings, and branch filter on all pages.

**Architecture:** Branch model in Prisma + branchId on all accounting/asset models + BranchProvider context (React Context + Cookie) wraps the dashboard layout — all pages consume it and pass ?branchId= to API routes.

**Tech Stack:** Next.js 14 App Router, Prisma (MongoDB), React Context, cookies

---

### Task 1: Prisma Schema — Add Branch Model + branchId fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Branch model before Account model (after OfficeLocation)**

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

**Step 2: Add branchId + relation to each model**

For `JournalEntry` (line 547):
```
model JournalEntry {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  date        DateTime @default(now())
  description String
  reference    String?
  status       String   @default("POSTED")

  branchId    String?  @db.ObjectId
  branch      Branch?  @relation(fields: [branchId], references: [id])

  lines       JournalLine[]
  payments    Payment[]
  purchaseBills PurchaseBill[]
  salesInvoices SalesInvoice[]
  expenses      Expense[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([date])
  @@index([reference])
  @@index([status])
  @@index([branchId])
  @@map("journal_entries")
}
```

For `Expense` (line 601):
```
model Expense {
  id              String        @id @default(auto()) @map("_id") @db.ObjectId
  expenseNumber   String        @unique
  date            DateTime      @default(now())
  payee            String
  description     String?
  status          ExpenseStatus @default(PENDING)

  branchId        String?       @db.ObjectId
  branch          Branch?       @relation(fields: [branchId], references: [id])

  items           ExpenseItem[]
  totalAmount     Float
  journalEntryId  String?       @db.ObjectId
  journalEntry    JournalEntry? @relation(fields: [journalEntryId], references: [id])

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([date])
  @@index([status])
  @@index([branchId])
  @@map("expenses")
}
```

For `SalesInvoice` (line 648):
```
model SalesInvoice {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  invoiceNumber String   @unique
  date          DateTime @default(now())
  dueDate       DateTime
  customerId    String   @db.ObjectId
  customerName   String
  status        SalesInvoiceStatus @default(DRAFT)

  branchId      String?  @db.ObjectId
  branch        Branch?  @relation(fields: [branchId], references: [id])

  items          SalesInvoiceItem[]
  totalAmount    Float
  amountPaid     Float    @default(0)
  journalEntryId String?  @db.ObjectId
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([customerId, status])
  @@index([date])
  @@index([branchId])
  @@map("sales_invoices")
}
```

For `PurchaseBill` (line 695):
```
model PurchaseBill {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  billNumber    String   @unique
  date          DateTime @default(now())
  dueDate       DateTime
  supplierId    String   @db.ObjectId
  supplierName   String
  status        PurchaseBillStatus @default(UNPAID)

  branchId      String?  @db.ObjectId
  branch        Branch?  @relation(fields: [branchId], references: [id])

  items          PurchaseBillItem[]
  totalAmount    Float
  amountPaid     Float    @default(0)
  journalEntryId String?  @db.ObjectId
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id])
  payments       Payment[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([supplierId, status])
  @@index([date])
  @@index([branchId])
  @@map("purchase_bills")
}
```

For `Payment` (line 735):
```
model Payment {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  billId         String       @map("purchaseBillId")
  bill           PurchaseBill @relation(fields: [billId], references: [id])
  amount         Float        @default(0)
  paymentDate    DateTime     @db.Date
  referenceNumber String?
  notes          String?

  branchId       String?      @db.ObjectId
  branch         Branch?      @relation(fields: [branchId], references: [id])

  cashAccountId  String       @map("cashAccountId")
  cashAccount    Account      @relation(fields: [cashAccountId], references: [id])
  journalEntryId String?      @map("journalEntryId")
  journalEntry   JournalEntry? @relation(fields: [journalEntryId], references: [id])
  createdAt      DateTime     @default(now()) @db.Date

  @@index([billId])
  @@index([paymentDate])
  @@index([branchId])
  @@map("payments")
}
```

For `PettyCash` (line 846):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `createdById` field, before `description`.

  @@index([branchId])
```

For `PettyCashDisbursement` (line 868):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `createdById` field, before `amount`.

  @@index([branchId])
```

For `PettyCashLiquidation` (line 895):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `submittedById` field, before `amount`.

  @@index([branchId])
```

For `AssetCategory` (line 775):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `description` field.

  @@index([branchId])
```

For `Asset` (line 787):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `categoryId` field.

  @@index([branchId])
```

For `AssetTransaction` (line 823):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `recordedById` field.

  @@index([branchId])
```

For `SubsidiaryLedger` (line 491):
```
  branchId       String?       @db.ObjectId
  branch         Branch?       @relation(fields: [branchId], references: [id])

Add after `isActive` field.

  @@index([branchId])
```

**Step 3: Push schema to MongoDB**

Run: `npx prisma db push`
Expected: output confirming Branch model created and all models updated

---

### Task 2: Branch CRUD API Routes

**Files:**
- Create: `app/api/branches/route.ts`
- Create: `app/api/branches/[id]/route.ts`

**Step 1: Create `app/api/branches/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, address, contactPerson, contactPhone, contactEmail } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const existing = await prisma.branch.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return NextResponse.json({ error: 'Branch name or code already exists' }, { status: 409 });
    }

    const branch = await prisma.branch.create({
      data: { name, code, address, contactPerson, contactPhone, contactEmail },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}
```

**Step 2: Create `app/api/branches/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, code, address, contactPerson, contactPhone, contactEmail, isActive } = body;

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(address !== undefined && { address }),
        ...(contactPerson !== undefined && { contactPerson }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Check if branch is in use
    const usageCounts = await Promise.all([
      prisma.journalEntry.count({ where: { branchId: id } }),
      prisma.expense.count({ where: { branchId: id } }),
      prisma.salesInvoice.count({ where: { branchId: id } }),
      prisma.purchaseBill.count({ where: { branchId: id } }),
      prisma.asset.count({ where: { branchId: id } }),
    ]);
    const totalUsage = usageCounts.reduce((a, b) => a + b, 0);

    if (totalUsage > 0) {
      return NextResponse.json({
        error: 'Cannot delete branch with existing transactions',
        usageCount: totalUsage,
      }, { status: 400 });
    }

    await prisma.branch.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 });
  }
}
```

---

### Task 3: BranchProvider Context + BranchSelector Component

**Files:**
- Create: `lib/branch-context.tsx`
- Create: `components/branch-selector.tsx`
- Modify: `app/(dashboard)/layout.tsx` — wrap with BranchProvider

**Step 1: Create `lib/branch-context.tsx`**

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive: boolean;
}

interface BranchContextValue {
  selectedBranch: Branch | null;
  branches: Branch[];
  loading: boolean;
  setBranch: (branch: Branch | null) => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranch: null,
  branches: [],
  loading: true,
  setBranch: () => {},
  refreshBranches: async () => {},
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      const data = await res.json() as Branch[];
      setBranches(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const data = await refreshBranches();

      // Read cookie for previously selected branch
      const cookies = document.cookie.split(';').reduce((acc, c) => {
        const [key, val] = c.trim().split('=');
        acc[key] = val;
        return acc;
      }, {} as Record<string, string>);

      const savedId = cookies['activeBranchId'];
      if (savedId) {
        const saved = data.find((b: Branch) => b.id === savedId);
        if (saved) setSelectedBranch(saved);
      }
      setLoading(false);
    }
    init();
  }, [refreshBranches]);

  const setBranch = useCallback((branch: Branch | null) => {
    setSelectedBranch(branch);
    if (branch) {
      document.cookie = `activeBranchId=${branch.id}; path=/; max-age=86400*30`;
    } else {
      document.cookie = 'activeBranchId=; path=/; max-age=0';
    }
  }, []);

  return (
    <BranchContext.Provider value={{ selectedBranch, branches, loading, setBranch, refreshBranches }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
```

**Step 2: Create `components/branch-selector.tsx`**

```typescript
'use client';

import { useBranch, Branch } from '@/lib/branch-context';
import { Building } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BranchSelectorProps {
  showAllOption?: boolean;
  className?: string;
}

export function BranchSelector({ showAllOption = true, className }: BranchSelectorProps) {
  const { selectedBranch, branches, setBranch } = useBranch();

  const handleChange = (value: string) => {
    if (value === '__all__') {
      setBranch(null);
    } else {
      const branch = branches.find((b) => b.id === value);
      if (branch) setBranch(branch);
    }
  };

  return (
    <div className={className}>
      <Select
        value={selectedBranch?.id || '__all__'}
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-[220px]">
          <Building className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="__all__">All Branches</SelectItem>
          )}
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

**Step 3: Modify `app/(dashboard)/layout.tsx` — wrap with BranchProvider**

Import and wrap:
```typescript
import { BranchProvider } from '@/lib/branch-context';

// Inside the return, wrap children:
<BranchProvider>
  {/* existing layout content */}
</BranchProvider>
```

Best placement: wrap the main content area after the sidebar, so the sidebar is also inside the context (for potential future use).

---

### Task 4: Settings Page — Branch CRUD Section

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`

**Step 1: Add branch state and fetch**

Add to existing imports:
```typescript
import { Building } from 'lucide-react';
import { BranchSelector } from '@/components/branch-selector';
import { useBranch, Branch } from '@/lib/branch-context';
```

Add branch state:
```typescript
const [branchForm, setBranchForm] = useState({
  name: '',
  code: '',
  address: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
});
const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
const [branchError, setBranchError] = useState('');
const { branches, refreshBranches } = useBranch();
```

**Step 2: Add branch CRUD handlers**

```typescript
async function handleCreateBranch() {
  if (!branchForm.name || !branchForm.code) {
    setBranchError('Name and code are required');
    return;
  }
  setBranchError('');
  try {
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branchForm),
    });
    if (!res.ok) {
      const err = await res.json();
      setBranchError(err.error || 'Failed to create branch');
      return;
    }
    setBranchForm({ name: '', code: '', address: '', contactPerson: '', contactPhone: '', contactEmail: '' });
    await refreshBranches();
  } catch {
    setBranchError('Failed to create branch');
  }
}

async function handleUpdateBranch(id: string) {
  setBranchError('');
  try {
    const res = await fetch(`/api/branches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branchForm),
    });
    if (!res.ok) {
      const err = await res.json();
      setBranchError(err.error || 'Failed to update branch');
      return;
    }
    setEditingBranchId(null);
    setBranchForm({ name: '', code: '', address: '', contactPerson: '', contactPhone: '', contactEmail: '' });
    await refreshBranches();
  } catch {
    setBranchError('Failed to update branch');
  }
}

async function handleDeleteBranch(id: string) {
  if (!confirm('Delete this branch? This cannot be undone if it has transactions.')) return;
  try {
    const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to delete branch');
      return;
    }
    await refreshBranches();
  } catch {
    alert('Failed to delete branch');
  }
}

function handleEditBranch(branch: Branch) {
  setEditingBranchId(branch.id);
  setBranchForm({
    name: branch.name,
    code: branch.code,
    address: branch.address || '',
    contactPerson: branch.contactPerson || '',
    contactPhone: branch.contactPhone || '',
    contactEmail: branch.contactEmail || '',
  });
}
```

**Step 3: Add Branch UI section before the closing `</div>` of the main card**

JSX for branch section (add before or after the Office Locations section):

```tsx
{/* Branch Management */}
<Card className="mt-6">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Building className="h-5 w-5" />
      Branches
    </CardTitle>
    <CardDescription>
      Manage company branches for accounting and asset inventory
    </CardDescription>
  </CardHeader>
  <CardContent>
    {branchError && (
      <div className="flex items-center gap-2 text-red-600 mb-4 p-2 bg-red-50 rounded">
        <AlertCircle className="h-4 w-4" />
        {branchError}
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <div>
        <Label>Branch Name *</Label>
        <Input
          value={branchForm.name}
          onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
          placeholder="e.g., Main Office"
        />
      </div>
      <div>
        <Label>Branch Code *</Label>
        <Input
          value={branchForm.code}
          onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
          placeholder="e.g., MAIN"
        />
      </div>
      <div>
        <Label>Address</Label>
        <Input
          value={branchForm.address}
          onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
          placeholder="e.g., 123 Rizal St."
        />
      </div>
      <div>
        <Label>Contact Person</Label>
        <Input
          value={branchForm.contactPerson}
          onChange={(e) => setBranchForm({ ...branchForm, contactPerson: e.target.value })}
          placeholder="e.g., Juan Dela Cruz"
        />
      </div>
      <div>
        <Label>Contact Phone</Label>
        <Input
          value={branchForm.contactPhone}
          onChange={(e) => setBranchForm({ ...branchForm, contactPhone: e.target.value })}
          placeholder="e.g., +63 912 345 6789"
        />
      </div>
      <div>
        <Label>Contact Email</Label>
        <Input
          value={branchForm.contactEmail}
          onChange={(e) => setBranchForm({ ...branchForm, contactEmail: e.target.value })}
          placeholder="e.g., branch@company.com"
        />
      </div>
    </div>

    <Button
      onClick={editingBranchId ? () => handleUpdateBranch(editingBranchId) : handleCreateBranch}
      className="mb-6"
    >
      <Save className="h-4 w-4 mr-2" />
      {editingBranchId ? 'Update Branch' : 'Add Branch'}
    </Button>

    {branches.length === 0 ? (
      <p className="text-muted-foreground">No branches yet. Create your first branch above.</p>
    ) : (
      <div className="space-y-2">
        {branches.map((branch) => (
          <div key={branch.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">{branch.name}</p>
              <p className="text-sm text-muted-foreground">{branch.code}{branch.address ? ` - ${branch.address}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEditBranch(branch)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteBranch(branch.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

---

### Task 5: Add BranchSelector to Dashboard Layout

**Files:**
- Modify: `app/(dashboard)/layout.tsx` — add BranchSelector in header

**Step 1: Add BranchSelector to the top bar**

Find the header area in the layout (around the theme toggle and user info). Add:

```typescript
import { BranchSelector } from '@/components/branch-selector';
import { useBranch } from '@/lib/branch-context';
```

Inside the JSX, add BranchSelector next to the theme toggle:

```tsx
<div className="flex items-center gap-2">
  <BranchSelector />
  <ThemeToggle />
  {/* ... existing header items */}
</div>
```

---

### Task 6: Update Accounting GET APIs — Add branchId Filter

**Files to modify (all GET handlers):**
- `app/api/accounting/expenses/route.ts`
- `app/api/accounting/sales/route.ts`
- `app/api/accounting/purchases/route.ts`
- `app/api/accounting/payments/route.ts`
- `app/api/accounting/journal/route.ts`
- `app/api/accounting/petty-cash/route.ts`
- `app/api/accounting/petty-cash/disbursements/route.ts`
- `app/api/accounting/petty-cash/liquidations/route.ts`
- `app/api/accounting/subsidiary-ledgers/route.ts`
- `app/api/accounting/accounts/[id]/transactions/route.ts`
- `app/api/accounting/customers/route.ts`
- `app/api/accounting/vendors/route.ts`
- `app/api/accounting/stats/route.ts`
- `app/api/accounting/reports/*/route.ts`
- `app/api/asset-inventory/route.ts` (or wherever asset CRUD is)

**Pattern for each GET handler (add after extracting searchParams):**

```typescript
const branchId = searchParams.get('branchId');

// In the where clause:
const where: any = {};
if (branchId) {
  where.branchId = branchId;
}
// ... rest of existing where logic merged
```

For `stats/route.ts` and `reports/*/route.ts`: add branchId filter similarly.

---

### Task 7: Update Accounting POST/PATCH APIs — Save branchId

**Files to modify (all POST/PATCH handlers):**

Same list as Task 6 but for POST and PATCH methods.

**Pattern for each POST handler:**

```typescript
const { branchId, ...rest } = await request.json();

// In the create:
const record = await tx.model.create({
  data: {
    ...rest,
    branchId: branchId || null,
  },
});
```

**Pattern for each PATCH handler:**

```typescript
// Accept branchId in body if provided
if (body.branchId !== undefined) {
  updateData.branchId = body.branchId || null;
}
```

For JournalEntry creation (in expenses, sales, purchases, payments routes): add `branchId` to the journal entry create call too.

---

### Task 8: Update Frontend Accounting Pages — Consume BranchContext

**Files to modify (all accounting pages):**
- `app/(dashboard)/accounting/expenses/page.tsx`
- `app/(dashboard)/accounting/sales/page.tsx`
- `app/(dashboard)/accounting/purchases/page.tsx`
- `app/(dashboard)/accounting/vendors/page.tsx`
- `app/(dashboard)/accounting/customers/page.tsx`
- `app/(dashboard)/accounting/journal/page.tsx`
- `app/(dashboard)/accounting/subsidiary-ledgers/page.tsx`
- `app/(dashboard)/accounting/petty-cash/page.tsx`
- `app/(dashboard)/accounting/reports/page.tsx`
- `app/(dashboard)/accounting/page.tsx` (dashboard stats)
- `app/(dashboard)/accounting/coa/page.tsx`
- `app/(dashboard)/accounting/coa/[id]/page.tsx`
- `app/(dashboard)/accounting/reconciliation/page.tsx`
- `app/(dashboard)/asset-inventory/page.tsx`
- `app/(dashboard)/asset-inventory/[id]/page.tsx`
- `app/(dashboard)/asset-inventory/new/page.tsx`
- `app/(dashboard)/asset-inventory/[id]/edit/page.tsx`
- `app/(dashboard)/asset-inventory/categories/page.tsx`
- `app/(dashboard)/asset-inventory/transactions/page.tsx`
- `app/(dashboard)/asset-inventory/reports/page.tsx`

**Pattern for each page:**

```typescript
import { useBranch } from '@/lib/branch-context';

export default function Page() {
  const { selectedBranch } = useBranch();
  // ...

  async function fetchData() {
    const params = new URLSearchParams();
    if (selectedBranch) params.set('branchId', selectedBranch.id);
    const res = await fetch(`/api/accounting/endpoint?${params}`);
    // ...
  }

  // Re-fetch when branch changes
  useEffect(() => {
    fetchData();
  }, [selectedBranch]);
}
```

---

### Task 9: Add Branch to Create/Edit Dialogs

For pages with create/edit dialogs (expenses, sales, purchases, petty-cash, assets):
- Add a BranchSelector dropdown in the dialog form
- Pass the selected branch ID in the POST/PATCH body
- Show branch info in the list view (optional column)

**Pattern for dialog:**

```typescript
import { useBranch } from '@/lib/branch-context';

// In form state:
const [formBranchId, setFormBranchId] = useState('');

// In dialog JSX:
<div>
  <Label>Branch</Label>
  <Select value={formBranchId} onValueChange={setFormBranchId}>
    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
    <SelectContent>
      {branches.map((b) => (
        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

### Task 10: Migration — Seed Default Branch

**Files:**
- Create: `app/api/branches/seed/route.ts`
- Modify: `app/(dashboard)/settings/page.tsx` — first-setup prompt

**Step 1: Create `app/api/branches/seed/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { name, code } = await request.json();
    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create the branch
      const branch = await tx.branch.create({ data: { name, code } });

      // Migrate existing records to this branch
      await tx.journalEntry.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.expense.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.salesInvoice.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.purchaseBill.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.payment.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.asset.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.assetCategory.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.subsidiaryLedger.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });
      await tx.pettyCash.updateMany({
        where: { branchId: null },
        data: { branchId: branch.id },
      });

      return branch;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error seeding branch:', error);
    return NextResponse.json({ error: 'Failed to seed branch' }, { status: 500 });
  }
}
```

**Step 2: Add first-setup prompt to settings page**

When `branches.length === 0` and user is admin, show a setup card:

```tsx
{branches.length === 0 && (
  <Card className="border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
    <CardHeader>
      <CardTitle>First-Time Setup</CardTitle>
      <CardDescription>
        Create your first branch to get started. Existing data will be assigned to this branch.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex gap-4 items-end">
        <div>
          <Label>Branch Name</Label>
          <Input
            value={setupBranchName}
            onChange={(e) => setSetupBranchName(e.target.value)}
            placeholder="e.g., Main Office"
          />
        </div>
        <div>
          <Label>Branch Code</Label>
          <Input
            value={setupBranchCode}
            onChange={(e) => setSetupBranchCode(e.target.value)}
            placeholder="e.g., MAIN"
          />
        </div>
        <Button onClick={handleSeedBranch}>
          <Building className="h-4 w-4 mr-2" />
          Create & Migrate
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

### Task 11: Update Holiday Model — Add Branch Relation

**Files:**
- Modify: `prisma/schema.prisma` — add `Branch` relation to Holiday

Replace bare `branchId String? @db.ObjectId` with:
```prisma
branchId String? @db.ObjectId
branch   Branch? @relation(fields: [branchId], references: [id])
```

Also add to Branch model:
```prisma
holidays             Holiday[]
```

---

### Task 12: Lint + Build Verification

**Step 1: Run ESLint**

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings ok)

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Dev server smoke test**

Run: `npm run dev`
Navigate to settings → create a branch → verify it shows in BranchSelector dropdown in header → navigate to expenses/accounting pages
