# CUSA Bills Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the CUSA bills management page with bill generation and payment recording functionality.

**Architecture:** Create a new page at `app/(dashboard)/cusa/bills/page.tsx` following existing patterns from water bills page. Use React hooks for state management and existing CUSA hooks for API calls.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide React icons, date-fns for date formatting

---

### Task 1: Create basic page structure with header and filters

**Files:**
- Create: `app/(dashboard)/cusa/bills/page.tsx`

**Step 1: Create the page file with basic structure**

```tsx
'use client'

import { useState, useMemo } from 'react'
import { FileText, CreditCard, Printer } from 'lucide-react'
import { useCusaBills, useGenerateCusaBills, useRecordCusaPayment } from '@/hooks/use-cusa'

export default function CusaBillsPage() {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterQuarter, setFilterQuarter] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (filterStatus) f.status = filterStatus
    if (filterQuarter) f.quarter = filterQuarter
    if (filterYear) f.year = filterYear
    return f
  }, [filterStatus, filterQuarter, filterYear])

  const { data: bills, isLoading } = useCusaBills(Object.keys(filters).length > 0 ? filters : undefined)
  const generateBills = useGenerateCusaBills()
  const recordPayment = useRecordCusaPayment()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">CUSA Bills</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <FileText className="w-4 h-4" /> Generate Bills
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <select
          value={filterQuarter}
          onChange={(e) => setFilterQuarter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="">All Quarters</option>
          <option value="1">Q1</option>
          <option value="2">Q2</option>
          <option value="3">Q3</option>
          <option value="4">Q4</option>
        </select>
        <input
          type="number"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          placeholder="Year"
          className="px-4 py-2 border rounded-lg w-24"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-sm">Bill No</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Quarter</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(bills || []).map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-medium">{bill.billNo}</td>
                  <td className="px-4 py-3">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-center">Q{bill.billingQuarter} {bill.billingYear}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">₱{bill.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      bill.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      bill.status === 'UNPAID' ? 'bg-yellow-100 text-yellow-700' :
                      bill.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={bill.status !== 'UNPAID'}
                      className={`p-1.5 rounded-lg ${bill.status !== 'UNPAID' ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'}`}
                      title="Record Payment"
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg" title="Print Bill">
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!bills || bills.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No bills found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Test the basic page structure**

Run: `npm run dev`
Expected: Page loads with header, filters, and empty table

**Step 3: Commit**

```bash
git add app/(dashboard)/cusa/bills/page.tsx
git commit -m "feat: add CUSA bills page with basic structure"
```

### Task 2: Add Generate Bills dialog

**Files:**
- Modify: `app/(dashboard)/cusa/bills/page.tsx`

**Step 1: Add state for Generate Bills dialog**

```tsx
// Add to state declarations
const [showGenerate, setShowGenerate] = useState(false)
const [genQuarter, setGenQuarter] = useState(1)
const [genYear, setGenYear] = useState(new Date().getFullYear())
const [genDueDate, setGenDueDate] = useState('')
const [genError, setGenError] = useState('')
const [genSuccess, setGenSuccess] = useState('')
```

**Step 2: Add Generate Bills dialog JSX**

```tsx
{/* Generate Bills Dialog */}
{showGenerate && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
      <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
        <h2 className="text-xl font-bold">Generate CUSA Bills</h2>
        <button onClick={() => setShowGenerate(false)}>
          <XCircle className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {genError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{genError}</div>}
        {genSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{genSuccess}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quarter *</label>
            <select
              value={genQuarter}
              onChange={(e) => setGenQuarter(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={1}>Q1 (Jan-Mar)</option>
              <option value={2}>Q2 (Apr-Jun)</option>
              <option value={3}>Q3 (Jul-Sep)</option>
              <option value={4}>Q4 (Oct-Dec)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year *</label>
            <input
              type="number"
              value={genYear}
              onChange={(e) => setGenYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Due Date *</label>
          <input
            type="date"
            value={genDueDate}
            onChange={(e) => setGenDueDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <p className="text-sm text-gray-500">
          Bills will be generated for all occupied units. Already-billed units will be skipped.
        </p>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowGenerate(false)}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generateBills.isPending}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generateBills.isPending ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 3: Add handleGenerate function**

```tsx
const handleGenerate = async () => {
  setGenError('')
  setGenSuccess('')

  if (!genDueDate) {
    setGenError('Due date is required')
    return
  }

  try {
    const result = await generateBills.mutateAsync({
      billingQuarter: genQuarter,
      billingYear: genYear,
      dueDate: genDueDate,
    })

    if (result && typeof result === 'object' && 'bills' in result) {
      setGenSuccess(`Generated ${result.bills.length} bill(s) successfully`)
    } else {
      setGenSuccess('Bills generated successfully')
    }

    setTimeout(() => { setShowGenerate(false); setGenSuccess('') }, 2000)
  } catch (err: unknown) {
    setGenError((err as { message?: string })?.message || 'Failed to generate bills')
  }
}
```

**Step 4: Update Generate Bills button to open dialog**

```tsx
<button
  onClick={() => {
    setGenQuarter(1)
    setGenYear(new Date().getFullYear())
    setGenDueDate('')
    setGenError('')
    setGenSuccess('')
    setShowGenerate(true)
  }}
  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  <FileText className="w-4 h-4" /> Generate Bills
</button>
```

**Step 5: Test Generate Bills dialog**

Run: `npm run dev`
Expected: Click "Generate Bills" opens dialog, fill form and submit generates bills

**Step 6: Commit**

```bash
git add app/(dashboard)/cusa/bills/page.tsx
git commit -m "feat: add Generate Bills dialog to CUSA bills page"
```

### Task 3: Add Record Payment dialog

**Files:**
- Modify: `app/(dashboard)/cusa/bills/page.tsx`

**Step 1: Add state for Record Payment dialog**

```tsx
// Add to state declarations
const [showPayment, setShowPayment] = useState(false)
const [payBill, setPayBill] = useState<unknown>(null)
const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
const [payMethod, setPayMethod] = useState('CASH')
const [payRef, setPayRef] = useState('')
const [payError, setPayError] = useState('')
```

**Step 2: Add openPayment function**

```tsx
const openPayment = (bill: unknown) => {
  setPayBill(bill)
  setPayDate(new Date().toISOString().split('T')[0])
  setPayMethod('CASH')
  setPayRef('')
  setPayError('')
  setShowPayment(true)
}
```

**Step 3: Add Record Payment dialog JSX**

```tsx
{/* Record Payment Dialog */}
{showPayment && payBill && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
      <div className="p-6 border-b flex justify-between items-center bg-green-600 text-white rounded-t-xl">
        <h2 className="text-xl font-bold">Record Payment</h2>
        <button onClick={() => setShowPayment(false)}>
          <XCircle className="w-6 h-6" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {payError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{payError}</div>}
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-500">Bill No:</span>
            <span className="font-medium">{payBill.billNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Amount Due:</span>
            <span className="font-bold text-lg">₱{payBill.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Payment Date *</label>
          <input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment Method *</label>
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="CASH">Cash</option>
            <option value="CHECK">Check</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Reference No.</label>
          <input
            type="text"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Check #, OR #, etc."
          />
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => setShowPayment(false)}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={recordPayment.isPending}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {recordPayment.isPending ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 4: Add handlePayment function**

```tsx
const handlePayment = async () => {
  setPayError('')

  if (!payBill) return

  try {
    await recordPayment.mutateAsync({
      billId: payBill.id,
      amount: payBill.totalAmount,
      paymentDate: payDate,
      paymentMethod: payMethod,
      referenceNo: payRef || undefined,
    })
    setShowPayment(false)
  } catch (err: unknown) {
    setPayError((err as { message?: string })?.message || 'Failed to record payment')
  }
}
```

**Step 5: Update Record Payment button in table**

```tsx
<button
  onClick={() => openPayment(bill)}
  disabled={bill.status !== 'UNPAID'}
  className={`p-1.5 rounded-lg ${bill.status !== 'UNPAID' ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'}`}
  title="Record Payment"
>
  <CreditCard className="w-4 h-4" />
</button>
```

**Step 6: Test Record Payment dialog**

Run: `npm run dev`
Expected: Click CreditCard icon on UNPAID bill opens payment dialog, fill form and submit records payment

**Step 7: Commit**

```bash
git add app/(dashboard)/cusa/bills/page.tsx
git commit -m "feat: add Record Payment dialog to CUSA bills page"
```

### Task 4: Add print functionality and final touches

**Files:**
- Modify: `app/(dashboard)/cusa/bills/page.tsx`

**Step 1: Add XCircle import**

```tsx
import { FileText, CreditCard, Printer, XCircle } from 'lucide-react'
```

**Step 2: Add print button functionality**

```tsx
<button
  onClick={() => window.open(`/cusa/bills/${bill.id}/print`, '_blank')}
  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg"
  title="Print Bill"
>
  <Printer className="w-4 h-4" />
</button>
```

**Step 3: Add OVERDUE status handling**

```tsx
// Update status badge logic
const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    UNPAID: 'bg-yellow-100 text-yellow-700',
    OVERDUE: 'bg-red-100 text-red-700',
  }
  return styles[status] || 'bg-gray-100 text-gray-600'
}
```

**Step 4: Test print functionality**

Run: `npm run dev`
Expected: Click Printer icon opens print page in new tab

**Step 5: Final test of all functionality**

Run: `npm run dev`
Expected: All features work: filters, generate bills, record payment, print

**Step 6: Commit**

```bash
git add app/(dashboard)/cusa/bills/page.tsx
git commit -m "feat: complete CUSA bills page with print functionality"
```

### Task 5: Run lint and typecheck

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Fix any issues if found**

**Step 4: Final commit if fixes needed**

```bash
git add .
git commit -m "fix: resolve lint and typecheck issues"
```

## Summary

This plan creates a complete CUSA bills management page with:
1. Basic page structure with header and filters
2. Generate Bills dialog for creating quarterly bills
3. Record Payment dialog for processing payments
4. Print functionality for bills
5. Status badges and action buttons

The implementation follows existing patterns from the water bills page and uses the provided CUSA hooks for API interactions.