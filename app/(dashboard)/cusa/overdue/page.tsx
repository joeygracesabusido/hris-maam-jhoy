'use client'

import { AlertTriangle, DollarSign, FileWarning } from 'lucide-react'
import { useCusaOverdue } from '@/hooks/use-cusa'
import type { CusaOverdueBill } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  UNPAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function CusaOverduePage() {
  const { data: overdueBills, isLoading, error } = useCusaOverdue()

  const bills: CusaOverdueBill[] = overdueBills || []

  const totalOverdueAmount = bills.reduce((sum, bill) => sum + bill.balance, 0)

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

if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-600 dark:text-red-400">Failed to load overdue report. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-600" />
        <h1 className="text-2xl font-bold">CUSA Overdue Report</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Overdue Amount</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOverdueAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <FileWarning className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Bills Count</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{bills.length}</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
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
                <th className="text-right px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Due Date</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Days Overdue</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium dark:text-white">{bill.billNo}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono dark:text-white">{formatCurrency(bill.balance || bill.totalAmount)}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-red-600 dark:text-red-400">{bill.daysOverdue}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      bill.daysOverdue > 0 ? STATUS_BADGE.OVERDUE : STATUS_BADGE.UNPAID
                    }`}>
                      {bill.daysOverdue > 0 ? 'OVERDUE' : 'UNPAID'}
                    </span>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No overdue bills found
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
