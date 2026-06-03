# Petty Cash Fund Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a detail dialog to each petty cash fund card showing the fund's full transaction ledger (disbursements, liquidations, replenishments) with running balance.

**Architecture:** New API endpoint at `/api/accounting/petty-cash/transactions?pettyCashId=X` fetches all disbursements + liquidations for a fund, plus reconstructs replenishment events from journal entries. Frontend merges them into a sorted ledger with running balance, displayed in a modal opened by a "View Details" button on each fund card.

**Tech Stack:** Next.js 14 App Router, Prisma (MongoDB), TypeScript

---

### Task 1: Create transactions API endpoint

**Files:**
- Create: `app/api/accounting/petty-cash/transactions/route.ts`

- [ ] **Step 1: Create the API route file**

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

interface FundTransaction {
  id: string;
  date: string;
  type: 'DISBURSEMENT' | 'LIQUIDATION' | 'REPLENISHMENT';
  description: string;
  payee: string | null;
  amount: number;
  status: string;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    if (!userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pettyCashId = searchParams.get('pettyCashId');

    if (!pettyCashId) {
      return NextResponse.json({ error: 'pettyCashId is required' }, { status: 400 });
    }

    const fund = await prisma.pettyCash.findUnique({
      where: { id: pettyCashId },
    });

    if (!fund) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }

    const [disbursements, liquidations] = await Promise.all([
      prisma.pettyCashDisbursement.findMany({
        where: { pettyCashId },
        orderBy: { date: 'asc' },
      }),
      prisma.pettyCashLiquidation.findMany({
        where: { pettyCashId },
        orderBy: { date: 'asc' },
      }),
    ]);

    const transactions: FundTransaction[] = [
      ...disbursements.map(d => ({
        id: d.id,
        date: (d.date || d.createdAt).toISOString(),
        type: 'DISBURSEMENT' as const,
        description: d.description || 'Disbursement',
        payee: d.payeeName,
        amount: d.amount,
        status: d.status,
      })),
      ...liquidations.map(l => ({
        id: l.id,
        date: (l.date || l.createdAt).toISOString(),
        type: 'LIQUIDATION' as const,
        description: l.notes || 'Liquidation',
        payee: null,
        amount: l.amount,
        status: l.status,
      })),
    ];

    // Fetch replenishment journal entries for this fund
    const replenishments = await prisma.journalEntry.findMany({
      where: {
        description: { contains: `Petty Cash Replenishment - ${fund.name}` },
        reference: { startsWith: 'REP-' },
      },
      orderBy: { date: 'asc' },
    });

    for (const rep of replenishments) {
      const creditLine = rep.lines?.find((l: any) => l.credit > 0);
      transactions.push({
        id: `rep-${rep.id}`,
        date: rep.date.toISOString(),
        type: 'REPLENISHMENT',
        description: `Replenishment${rep.reference ? ` (${rep.reference})` : ''}`,
        payee: null,
        amount: creditLine?.credit || 0,
        status: rep.status,
      });
    }

    // Sort by date ascending
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = fund.fundAmount;
    const entries = transactions.map(t => {
      if (t.type === 'DISBURSEMENT') {
        runningBalance -= t.amount;
      } else if (t.type === 'LIQUIDATION' || t.type === 'REPLENISHMENT') {
        runningBalance += t.amount;
      }
      return { ...t, runningBalance };
    });

    return NextResponse.json({
      fund: {
        id: fund.id,
        name: fund.name,
        fundAmount: fund.fundAmount,
        currentBalance: fund.currentBalance,
        status: fund.status,
      },
      entries,
    });
  } catch (error) {
    console.error('Error fetching fund transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "transactions" -SimpleMatch
```

Expected: No output (no errors for the new file)

---

### Task 2: Add "View Details" button and detail modal to the page

**Files:**
- Modify: `app/(dashboard)/accounting/petty-cash/page.tsx`

- [ ] **Step 1: Add new state variables after line 84**

Insert after `const [replenishTarget, setReplenishTarget] = useState<PettyCashFund | null>(null);` (line 84):

```typescript
const [isDetailDialogOpen, setDetailDialogOpen] = useState(false);
const [detailFund, setDetailFund] = useState<PettyCashFund | null>(null);
const [detailEntries, setDetailEntries] = useState<FundTransaction[]>([]);
const [detailLoading, setDetailLoading] = useState(false);
```

Add the `FundTransaction` interface after the existing `Liquidation` interface (after line 59):

```typescript
interface FundTransaction {
  id: string;
  date: string;
  type: 'DISBURSEMENT' | 'LIQUIDATION' | 'REPLENISHMENT';
  description: string;
  payee: string | null;
  amount: number;
  status: string;
  runningBalance: number;
}
```

- [ ] **Step 2: Add `openFundDetail` handler function**

Add after the `openEditDialog` function (after line 396):

```typescript
async function openFundDetail(fund: PettyCashFund) {
  setDetailFund(fund);
  setDetailDialogOpen(true);
  setDetailLoading(true);
  setDetailEntries([]);
  try {
    const res = await fetch(`/api/accounting/petty-cash/transactions?pettyCashId=${fund.id}`);
    if (res.ok) {
      const data = await res.json();
      setDetailEntries(data.entries || []);
    }
  } catch (err) {
    console.error('Error fetching fund transactions:', err);
  } finally {
    setDetailLoading(false);
  }
}
```

- [ ] **Step 3: Add "View Details" button to each fund card**

In the fund card JSX, add a "View Details" button inside the button group around line 546-577. Insert after the "Replenish" button:

```tsx
<Button
  variant="outline"
  size="sm"
  className="flex-1"
  onClick={() => openFundDetail(fund)}
>
  <ArrowRight className="w-4 h-4 mr-1" />
  Details
</Button>
```

This requires adding the `ArrowRight` import — it's already imported on line 10.

- [ ] **Step 4: Add the detail dialog JSX**

Add before the closing `</div>` of the page (before line 968 `</div>`):

```tsx
<Dialog open={isDetailDialogOpen} onOpenChange={setDetailDialogOpen}>
  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{detailFund?.name}</DialogTitle>
      <DialogDescription>
        Transaction ledger for this petty cash fund
      </DialogDescription>
    </DialogHeader>

    {detailFund && (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium">Fund Amount</p>
            <p className="text-lg font-bold text-blue-800">
              ₱{detailFund.fundAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 font-medium">Current Balance</p>
            <p className={`text-lg font-bold ${detailFund.currentBalance > 0 ? 'text-green-800' : 'text-red-800'}`}>
              ₱{detailFund.currentBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-xs text-purple-600 font-medium">Net Spent</p>
            <p className="text-lg font-bold text-purple-800">
              ₱{(detailFund.fundAmount - detailFund.currentBalance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {detailLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
        ) : detailEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No transactions found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {new Date(entry.date).toLocaleDateString('en-PH')}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      entry.type === 'DISBURSEMENT' ? 'bg-red-50 text-red-700' :
                      entry.type === 'LIQUIDATION' ? 'bg-green-50 text-green-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {entry.type === 'DISBURSEMENT' ? 'Disburse' :
                       entry.type === 'LIQUIDATION' ? 'Liquidate' : 'Replenish'}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                  <TableCell>{entry.payee || '-'}</TableCell>
                  <TableCell className={`text-right font-mono ${
                    entry.type === 'DISBURSEMENT' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {entry.type === 'DISBURSEMENT' ? '-' : '+'}₱
                    {entry.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₱{entry.runningBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      entry.status === 'APPROVED' || entry.status === 'POSTED' ? 'bg-green-100 text-green-800' :
                      entry.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      entry.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100'
                    }`}>
                      {entry.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Run lint to verify**

```bash
npm run lint
```

Expected: No output (clean lint)

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | Select-String -Pattern "petty-cash" -SimpleMatch
```

Expected: No output (no type errors in the petty-cash page)

---

### Self-Review Checklist

- [ ] Spec coverage: The plan covers the requested feature — a detail dialog per fund with transaction ledger showing disbursements, liquidations, replenishments, and running balance.
- [ ] Placeholder scan: No TBD, TODO, or placeholders remain.
- [ ] Type consistency: `FundTransaction` interface is defined once and used consistently.
