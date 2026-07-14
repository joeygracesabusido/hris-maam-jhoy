'use client'

import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { usePayments, useDeletePayment } from '@/hooks/use-water'
import type { WaterPayment } from '@/hooks/use-water'
import { format } from 'date-fns'

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const { data: payments, isLoading } = usePayments()
  const deletePayment = useDeletePayment()

  const handleDelete = async (payment: WaterPayment) => {
    if (!confirm(`Delete payment of ₱${payment.amount.toFixed(2)}? This will reverse the journal entry.`)) return
    try {
      await deletePayment.mutateAsync(payment.id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete payment')
    }
  }

  const filteredPayments = payments?.filter((p) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (p.bill?.billNo || '').toLowerCase().includes(term) ||
      (p.bill?.tenant?.fullName || '').toLowerCase().includes(term) ||
      (p.referenceNo || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Payments</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search by bill no., tenant, or reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-900 dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Date</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Bill No.</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Tenant</th>
                <th className="text-right px-4 py-3 font-medium text-sm dark:text-gray-300">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Method</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-sm dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {(filteredPayments || []).map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 dark:text-gray-300">{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</td>
                  <td className="px-4 py-3 font-mono text-sm dark:text-gray-300">{payment.bill?.billNo || '—'}</td>
                  <td className="px-4 py-3 dark:text-gray-300">{payment.bill?.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-green-600 dark:text-green-400">₱{payment.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      payment.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      payment.paymentMethod === 'CHECK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {payment.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{payment.referenceNo || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(payment)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/30"
                      title="Delete Payment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredPayments || filteredPayments.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No payments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
