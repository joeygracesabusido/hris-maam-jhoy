'use client'

import { useState, useMemo } from 'react'
import { FileText, CreditCard, Printer, XCircle } from 'lucide-react'
import { useCusaBills, useGenerateCusaBills, useRecordCusaPayment } from '@/hooks/use-cusa'
import type { CusaBill } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  UNPAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

const PAYMENT_METHODS = ['Cash', 'Check', 'Bank Transfer']

export default function CusaBillsPage() {
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<CusaBill | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [quarterFilter, setQuarterFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [error, setError] = useState('')

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (statusFilter) f.status = statusFilter
    if (quarterFilter) f.quarter = quarterFilter
    if (yearFilter) f.year = yearFilter
    return f
  }, [statusFilter, quarterFilter, yearFilter])

  const { data: bills, isLoading } = useCusaBills(Object.keys(filters).length > 0 ? filters : undefined)
  const generateBills = useGenerateCusaBills()
  const recordPayment = useRecordCusaPayment()

  const [generateForm, setGenerateForm] = useState({
    billingQuarter: 1,
    billingYear: new Date().getFullYear(),
    dueDate: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    referenceNo: '',
  })

  const resetGenerateForm = () => {
    setGenerateForm({
      billingQuarter: 1,
      billingYear: new Date().getFullYear(),
      dueDate: '',
    })
    setError('')
  }

  const resetPaymentForm = () => {
    setPaymentForm({
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      referenceNo: '',
    })
    setSelectedBill(null)
    setError('')
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!generateForm.dueDate) {
      setError('Due date is required')
      return
    }

    try {
      await generateBills.mutateAsync(generateForm)
      setShowGenerateModal(false)
      resetGenerateForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to generate bills')
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedBill) return

    try {
      await recordPayment.mutateAsync({
        billId: selectedBill.id,
        amount: selectedBill.totalAmount,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        referenceNo: paymentForm.referenceNo || undefined,
      })
      setShowPaymentModal(false)
      resetPaymentForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to record payment')
    }
  }

  const openPaymentModal = (bill: CusaBill) => {
    setSelectedBill(bill)
    resetPaymentForm()
    setShowPaymentModal(true)
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getQuarterName = (quarter: number) => {
    return `Q${quarter}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">CUSA Bills</h1>
        </div>
        <button
          onClick={() => {
            resetGenerateForm()
            setShowGenerateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FileText className="w-4 h-4" /> Generate Bills
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <select
          value={quarterFilter}
          onChange={(e) => setQuarterFilter(e.target.value)}
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
          placeholder="Year"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg w-32"
          min="2000"
          max="2100"
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
                  <td className="px-4 py-3 font-medium">{bill.billNo}</td>
                  <td className="px-4 py-3 text-gray-600">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {getQuarterName(bill.billingQuarter)} {bill.billingYear}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(bill.totalAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_BADGE[bill.status] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3 text-right">
                    {bill.status === 'UNPAID' && (
                      <button
                        onClick={() => openPaymentModal(bill)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg mr-2"
                        title="Record Payment"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => window.print()}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Print Bill"
                    >
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

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Generate Bills</h2>
              <button onClick={() => { setShowGenerateModal(false); resetGenerateForm() }}>
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Quarter *</label>
                <select
                  value={generateForm.billingQuarter}
                  onChange={(e) => setGenerateForm({ ...generateForm, billingQuarter: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value={1}>Q1</option>
                  <option value={2}>Q2</option>
                  <option value={3}>Q3</option>
                  <option value={4}>Q4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year *</label>
                <input
                  type="number"
                  value={generateForm.billingYear}
                  onChange={(e) => setGenerateForm({ ...generateForm, billingYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="2000"
                  max="2100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date *</label>
                <input
                  type="date"
                  value={generateForm.dueDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowGenerateModal(false); resetGenerateForm() }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateBills.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateBills.isPending ? 'Generating...' : 'Generate Bills'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b flex justify-between items-center bg-green-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <button onClick={() => { setShowPaymentModal(false); resetPaymentForm() }}>
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill No:</span>
                  <span className="font-medium">{selectedBill.billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Due:</span>
                  <span className="font-medium text-lg">{formatCurrency(selectedBill.totalAmount)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference No</label>
                <input
                  type="text"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); resetPaymentForm() }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPayment.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}