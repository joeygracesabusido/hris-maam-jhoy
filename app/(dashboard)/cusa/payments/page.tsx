'use client'

import { useState, useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import { useCusaPayments } from '@/hooks/use-cusa'
import type { CusaPayment } from '@/hooks/use-cusa'

const PAYMENT_METHODS = ['Cash', 'Check', 'Bank Transfer']

export default function CusaPaymentsPage() {
  const [methodFilter, setMethodFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (methodFilter) f.method = methodFilter
    if (startDate) f.startDate = startDate
    if (endDate) f.endDate = endDate
    return f
  }, [methodFilter, startDate, endDate])

  const { data: payments, isLoading } = useCusaPayments(
    Object.keys(filters).length > 0 ? filters : undefined
  )

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold">CUSA Payments</h1>
      </div>

      <div className="flex gap-4 flex-wrap">
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        >
          <option value="">All Methods</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="From"
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="To"
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Payment No</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Bill No</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Tenant</th>
                <th className="text-right px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Payment Date</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Method</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Reference No</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(payments || []).map((payment: CusaPayment & { bill?: { billNo?: string; unit?: { unitNo?: string }; tenant?: { fullName?: string } } }) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium dark:text-white">{payment.paymentNo}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{payment.bill?.billNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{payment.bill?.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{payment.bill?.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono dark:text-white">{formatCurrency(payment.amount)}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(payment.paymentDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {payment.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{payment.referenceNo || '—'}</td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
