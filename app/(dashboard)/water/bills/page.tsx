'use client'

import { useState } from 'react'
import { Search, XCircle, FileText, Printer, DollarSign, Trash2 } from 'lucide-react'
import { useBills, useGenerateBills, useUpdateBill, useDeleteBill, useRates, useTenants, useCreatePayment } from '@/hooks/use-water'
import type { WaterBill } from '@/hooks/use-water'
import { format } from 'date-fns'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function BillsPage() {
  const currentYear = new Date().getUTCFullYear()
  const currentMonth = new Date().getUTCMonth() + 1

  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth))
  const [filterYear, setFilterYear] = useState<string>(String(currentYear))
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Generate bills modal
  const [showGenerate, setShowGenerate] = useState(false)
  const [genMonth, setGenMonth] = useState(currentMonth)
  const [genYear, setGenYear] = useState(currentYear)
  const [genRateId, setGenRateId] = useState('')
  const [genDueDate, setGenDueDate] = useState('')
  const [genError, setGenError] = useState('')
  const [genSuccess, setGenSuccess] = useState('')

  // Bill detail modal
  const [selectedBill, setSelectedBill] = useState<WaterBill | null>(null)

  // Payment modal
  const [showPayment, setShowPayment] = useState(false)
  const [payBillId, setPayBillId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState('CASH')
  const [payRef, setPayRef] = useState('')
  const [payError, setPayError] = useState('')

  const filters: Record<string, string> = {}
  if (filterMonth) filters.month = filterMonth
  if (filterYear) filters.year = filterYear
  if (filterStatus) filters.status = filterStatus
  if (filterTenant) filters.tenantId = filterTenant

  const { data: bills, isLoading } = useBills(filters)
  const { data: rates } = useRates({ isActive: 'true' })
  const { data: tenants } = useTenants()
  const generateBills = useGenerateBills()
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()
  const createPayment = useCreatePayment()

  const handleGenerate = async () => {
    setGenError('')
    setGenSuccess('')

    if (!genRateId || !genDueDate) {
      setGenError('Rate and due date are required')
      return
    }

    try {
      const result = await generateBills.mutateAsync({
        billingMonth: genMonth,
        billingYear: genYear,
        rateId: genRateId,
        dueDate: genDueDate,
      })

      if (Array.isArray(result)) {
        setGenSuccess(`Generated ${result.length} bill(s) successfully`)
      } else {
        setGenSuccess(result?.message || 'No bills generated')
      }

      setTimeout(() => { setShowGenerate(false); setGenSuccess('') }, 2000)
    } catch (err: unknown) {
      setGenError((err as { message?: string })?.message || 'Failed to generate bills')
    }
  }

  const openPayment = (bill: WaterBill) => {
    if (bill.status === 'PAID') return
    setPayBillId(bill.id)
    setPayAmount(String(bill.balance))
    setPayDate(new Date().toISOString().split('T')[0])
    setPayMethod('CASH')
    setPayRef('')
    setPayError('')
    setShowPayment(true)
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayError('')

    if (!payAmount || parseFloat(payAmount) <= 0) {
      setPayError('Amount must be greater than 0')
      return
    }

    try {
      await createPayment.mutateAsync({
        billId: payBillId,
        amount: parseFloat(payAmount),
        paymentDate: payDate,
        paymentMethod: payMethod,
        referenceNo: payRef || undefined,
      })
      setShowPayment(false)
      setSelectedBill(null)
    } catch (err: unknown) {
      setPayError((err as { message?: string })?.message || 'Failed to record payment')
    }
  }

  const handleVoid = async (id: string) => {
    if (!confirm('Void this bill? This will reverse the journal entry.')) return
    try {
      await updateBill.mutateAsync({ id, data: { status: 'VOID' } as Partial<WaterBill> })
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to void bill')
    }
  }

  const handleDelete = async (bill: WaterBill) => {
    if (!confirm(`Delete bill ${bill.billNo}?`)) return
    try {
      await deleteBill.mutateAsync(bill.id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete bill')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-600',
      UNPAID: 'bg-yellow-100 text-yellow-700',
      PAID: 'bg-green-100 text-green-700',
      PARTIAL: 'bg-blue-100 text-blue-700',
      OVERDUE: 'bg-red-100 text-red-700',
      VOID: 'bg-gray-100 text-gray-500',
      WRITTEN_OFF: 'bg-red-50 text-red-500',
    }
    return styles[status] || 'bg-gray-100 text-gray-600'
  }

  const filteredBills = bills?.filter((b) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      b.billNo.toLowerCase().includes(term) ||
      (b.tenant?.fullName || '').toLowerCase().includes(term) ||
      (b.meter?.meterNo || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Water Bills</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setGenMonth(currentMonth)
              setGenYear(currentYear)
              setGenRateId('')
              setGenDueDate('')
              setGenError('')
              setGenSuccess('')
              setShowGenerate(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileText className="w-4 h-4" /> Generate Bills
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border rounded-lg">
          {MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="px-3 py-2 border rounded-lg">
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="OVERDUE">Overdue</option>
          <option value="DRAFT">Draft</option>
          <option value="VOID">Void</option>
        </select>
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Tenants</option>
          {(tenants || []).map((t) => (
            <option key={t.id} value={t.id}>{t.fullName}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-sm">Bill No.</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Period</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Consumption</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Balance</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(filteredBills || []).map((bill) => (
                <tr
                  key={bill.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedBill(bill)}
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium">{bill.billNo}</td>
                  <td className="px-4 py-3">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {MONTHS[bill.billingMonth - 1]} {bill.billingYear}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{bill.consumption.toFixed(1)} m³</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">₱{bill.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">₱{bill.amountPaid.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">₱{bill.balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(bill.status)}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPayment(bill) }}
                      disabled={bill.status === 'PAID' || bill.status === 'VOID'}
                      className={`p-1.5 rounded-lg ${bill.status === 'PAID' || bill.status === 'VOID' ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'}`}
                      title="Record Payment"
                    >
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(`/water/bills/${bill.id}/print`, '_blank') }}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg"
                      title="Print Bill"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    {(bill.status === 'DRAFT' || bill.status === 'UNPAID') && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(bill) }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete Bill"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!filteredBills || filteredBills.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No bills found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Bills Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Generate Water Bills</h2>
              <button onClick={() => setShowGenerate(false)}><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              {genError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{genError}</div>}
              {genSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{genSuccess}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Month</label>
                  <select value={genMonth} onChange={(e) => setGenMonth(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <select value={genYear} onChange={(e) => setGenYear(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rate *</label>
                <select value={genRateId} onChange={(e) => setGenRateId(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select rate...</option>
                  {(rates || []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.rateType})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input type="date" value={genDueDate} onChange={(e) => setGenDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <p className="text-sm text-gray-500">
                Bills will be generated for all active meters with readings in the selected period. Already-billed meters will be skipped.
              </p>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowGenerate(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleGenerate} disabled={generateBills.isPending} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {generateBills.isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Bill {selectedBill.billNo}</h2>
              <button onClick={() => setSelectedBill(null)}><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tenant</h3>
                  <p className="font-medium">{selectedBill.tenant?.fullName || '—'}</p>
                  <p className="text-sm text-gray-500">{selectedBill.tenant?.unitNo || ''}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(selectedBill.status)}`}>
                    {selectedBill.status}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Reading Details</h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Previous</p>
                    <p className="font-mono font-bold">{selectedBill.previousReading.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Current</p>
                    <p className="font-mono font-bold">{selectedBill.currentReading.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Consumption</p>
                    <p className="font-mono font-bold text-blue-600">{selectedBill.consumption.toFixed(1)} m³</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Meter</p>
                    <p className="font-mono">{selectedBill.meter?.meterNo || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Bill Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Billing Period</span>
                    <span>{MONTHS[selectedBill.billingMonth - 1]} {selectedBill.billingYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due Date</span>
                    <span>{format(new Date(selectedBill.dueDate), 'MMM dd, yyyy')}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Total Amount</span>
                    <span>₱{selectedBill.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span>₱{selectedBill.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold">
                    <span>Balance</span>
                    <span className={selectedBill.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                      ₱{selectedBill.balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedBill.payments && selectedBill.payments.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Payment History</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-2 py-1">Date</th>
                        <th className="text-right px-2 py-1">Amount</th>
                        <th className="text-left px-2 py-1">Method</th>
                        <th className="text-left px-2 py-1">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="px-2 py-1">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                          <td className="px-2 py-1 text-right font-mono">₱{p.amount.toFixed(2)}</td>
                          <td className="px-2 py-1">{p.paymentMethod}</td>
                          <td className="px-2 py-1">{p.referenceNo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                {selectedBill.status !== 'PAID' && selectedBill.status !== 'VOID' && (
                  <button
                    onClick={() => { setSelectedBill(null); openPayment(selectedBill) }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Record Payment
                  </button>
                )}
                <button
                  onClick={() => { window.open(`/water/bills/${selectedBill.id}/print`, '_blank') }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                {(selectedBill.status === 'DRAFT' || selectedBill.status === 'UNPAID') && (
                  <button onClick={() => handleVoid(selectedBill.id)} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                    Void
                  </button>
                )}
                {(selectedBill.status === 'DRAFT' || selectedBill.status === 'UNPAID') && (
                  <button onClick={() => handleDelete(selectedBill)} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-green-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <button onClick={() => setShowPayment(false)}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              {payError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{payError}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-lg font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
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
                <button type="button" onClick={() => setShowPayment(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={createPayment.isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {createPayment.isPending ? 'Processing...' : 'Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
