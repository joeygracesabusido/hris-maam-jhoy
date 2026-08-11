'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, CreditCard, Printer, Pencil, Trash2, XCircle, Building } from 'lucide-react'
import { useCusaBills, useGenerateCusaBills, useUpdateCusaBill, useDeleteCusaBill, useRecordCusaPayment, useCusaUnits } from '@/hooks/use-cusa'
import type { CusaBill, CusaUnit } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UNPAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const PAYMENT_METHODS = ['Cash', 'Check', 'Bank Transfer']

export default function CusaBillsPage() {
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<CusaBill | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [quarterFilter, setQuarterFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editStatus, setEditStatus] = useState('')
  const [error, setError] = useState('')

  const updateBill = useUpdateCusaBill()
  const deleteBill = useDeleteCusaBill()

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
    billingMonth: new Date().getMonth() + 1, // 1-12
    billingYear: new Date().getFullYear(),
    billingMonths: 1,
    dueDate: '',
  })

  const getQuarterFromMonth = (month: number): number => Math.ceil(month / 3)

  const getEndMonth = (startMonth: number, count: number): number => {
    const end = startMonth + count - 1
    return end > 12 ? 12 : end
  }

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    referenceNo: '',
  })

  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(true)
  const { data: availableUnits, isLoading: unitsLoading } = useCusaUnits({ status: 'OCCUPIED' })

  const toggleUnit = (id: string) => {
    setSelectedUnitIds((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    )
    setSelectAll(false)
  }

  const toggleSelectAll = () => {
    if (!availableUnits) return
    if (selectAll) {
      setSelectedUnitIds([])
    } else {
      setSelectedUnitIds(availableUnits.map((u) => u.id))
    }
    setSelectAll(!selectAll)
  }

  const resetGenerateForm = () => {
    setGenerateForm({
      billingMonth: new Date().getMonth() + 1,
      billingYear: new Date().getFullYear(),
      billingMonths: 1,
      dueDate: '',
    })
    setSelectedUnitIds([])
    setSelectAll(true)
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
      await generateBills.mutateAsync({
        billingQuarter: getQuarterFromMonth(generateForm.billingMonth),
        billingYear: generateForm.billingYear,
        billingMonth: generateForm.billingMonth,
        dueDate: generateForm.dueDate,
        billingMonths: generateForm.billingMonths,
        unitIds: selectedUnitIds.length > 0 && !selectAll ? selectedUnitIds : undefined,
      })
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

  const openEditModal = (bill: CusaBill) => {
    setSelectedBill(bill)
    setEditStatus(bill.status)
    setError('')
    setShowEditModal(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedBill) return

    try {
      await updateBill.mutateAsync({ id: selectedBill.id, status: editStatus })
      setShowEditModal(false)
      setSelectedBill(null)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to update bill')
    }
  }

  const handleDelete = async (bill: CusaBill) => {
    if (!confirm(`Delete bill ${bill.billNo}? This cannot be undone.`)) return
    try {
      await deleteBill.mutateAsync(bill.id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete bill')
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
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
        <select
          value={quarterFilter}
          onChange={(e) => setQuarterFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
          className="px-4 py-2 border rounded-lg w-32 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          min="2000"
          max="2100"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Bill No</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Quarter</th>
                <th className="text-right px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(bills || []).map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium dark:text-white">{bill.billNo}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-center dark:text-white">
                    {getQuarterName(bill.billingQuarter)} {bill.billingYear}
                  </td>
                  <td className="px-4 py-3 text-right font-mono dark:text-white">{formatCurrency(bill.totalAmount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_BADGE[bill.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEditModal(bill)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                      title="Edit Status"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {bill.status === 'UNPAID' && (
                      <button
                        onClick={() => openPaymentModal(bill)}
                        className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                        title="Record Payment"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      href={`/cusa/bills/${bill.id}/print`}
                      target="_blank"
                      className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg inline-flex"
                      title="Print Bill"
                    >
                      <Printer className="w-4 h-4" />
                    </Link>
                    {bill.status !== 'PAID' && (
                      <button
                        onClick={() => handleDelete(bill)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!bills || bills.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No bills found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Generate Bills</h2>
              <button onClick={() => { setShowGenerateModal(false); resetGenerateForm() }}>
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Month *</label>
                <select
                  value={generateForm.billingMonth}
                  onChange={(e) => setGenerateForm({ ...generateForm, billingMonth: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  required
                >
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Quarter {getQuarterFromMonth(generateForm.billingMonth)} · {generateForm.billingYear}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Year *</label>
                <input
                  type="number"
                  value={generateForm.billingYear}
                  onChange={(e) => setGenerateForm({ ...generateForm, billingYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  min="2000"
                  max="2100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Billing Period</label>
                <select
                  value={generateForm.billingMonths}
                  onChange={(e) => setGenerateForm({ ...generateForm, billingMonths: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(generateForm.billingYear, generateForm.billingMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                  {generateForm.billingMonths > 1 && ` – ${new Date(generateForm.billingYear, getEndMonth(generateForm.billingMonth, generateForm.billingMonths) - 1, 1).toLocaleDateString('en-US', { month: 'long' })}`}
                  {' · '}
                  {generateForm.billingMonths} month{generateForm.billingMonths > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Due Date *</label>
                <input
                  type="date"
                  value={generateForm.dueDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-2 dark:text-gray-300">
                  <Building className="w-4 h-4" /> Units / Tenants
                </label>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1 dark:border-gray-700 dark:bg-gray-900">
                  {unitsLoading ? (
                    <p className="text-sm text-gray-400 p-2">Loading units...</p>
                  ) : !availableUnits || availableUnits.length === 0 ? (
                    <p className="text-sm text-gray-400 p-2">No occupied units found</p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium cursor-pointer border-b dark:border-gray-700 pb-2 mb-1">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                        {selectAll ? 'All Units Selected' : 'Select All'}
                      </label>
                      {availableUnits.map((unit: CusaUnit) => (
                        <label
                          key={unit.id}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectAll || selectedUnitIds.includes(unit.id)}
                            onChange={() => toggleUnit(unit.id)}
                            className="rounded"
                          />
                          <span className="font-medium dark:text-white">{unit.unitNo}</span>
                          <span className="text-gray-500 dark:text-gray-400 truncate">
                            — {unit.tenant?.fullName || 'No tenant'}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500 text-xs ml-auto">
                            {unit.areaSqm}m²
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {selectAll
                    ? `Generating bills for all ${availableUnits?.length || 0} occupied units`
                    : `Selected ${selectedUnitIds.length} of ${availableUnits?.length || 0} units`}
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowGenerateModal(false); resetGenerateForm() }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
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

      {showEditModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Edit Bill Status</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedBill(null) }}>
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Bill No:</span>
                  <span className="font-medium dark:text-white">{selectedBill.billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_BADGE[selectedBill.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {selectedBill.status}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">New Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  required
                >
                  <option value="UNPAID">Unpaid</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="VOID">Void</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedBill(null) }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBill.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateBill.isPending ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md shadow-xl">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-green-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <button onClick={() => { setShowPaymentModal(false); resetPaymentForm() }}>
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Bill No:</span>
                  <span className="font-medium dark:text-white">{selectedBill.billNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount Due:</span>
                  <span className="font-medium text-lg dark:text-white">{formatCurrency(selectedBill.totalAmount)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Payment Method *</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
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
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reference No</label>
                <input
                  type="text"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); resetPaymentForm() }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
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