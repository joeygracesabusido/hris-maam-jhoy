'use client'

import { AlertTriangle, DollarSign, FileWarning } from 'lucide-react'
import { useCusaOverdue } from '@/hooks/use-cusa'
import type { CusaOverdueBill } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  UNPAID: 'bg-yellow-100 text-yellow-700',
  OVERDUE: 'bg-red-100 text-red-700',
}

export default function CusaOverduePage() {
  const { data: overdueBills, isLoading } = useCusaOverdue()

  const bills: CusaOverdueBill[] = overdueBills || []

  const totalOverdueAmount = bills.reduce((sum, bill) => sum + (bill.balance || bill.totalAmount), 0)

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
        <AlertTriangle className="w-8 h-8 text-red-600" />
        <h1 className="text-2xl font-bold">CUSA Overdue Report</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Overdue Amount</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdueAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <FileWarning className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overdue Bills Count</p>
              <p className="text-2xl font-bold text-orange-600">{bills.length}</p>
            </div>
          </div>
        </div>
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
                <th className="text-right px-4 py-3 font-medium text-sm">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Due Date</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Days Overdue</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{bill.billNo}</td>
                  <td className="px-4 py-3 text-gray-600">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(bill.balance || bill.totalAmount)}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-500">{formatDate(bill.dueDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-red-600">{bill.daysOverdue}</span>
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
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
