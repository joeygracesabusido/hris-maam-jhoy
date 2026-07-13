'use client'

import { Building2, DollarSign, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useCusaDashboard, useCusaBills } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UNPAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PARTIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  VOID: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default function CusaDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useCusaDashboard()
  const { data: bills, isLoading: billsLoading } = useCusaBills({ limit: '5' })

  const isLoading = statsLoading || billsLoading

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  const summaryStats = [
    {
      label: 'Total Billed',
      value: formatCurrency(stats?.totalBilled || 0),
      icon: DollarSign,
      color: 'bg-blue-500',
    },
    {
      label: 'Collected',
      value: formatCurrency(stats?.collected || 0),
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(stats?.outstanding || 0),
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: 'Overdue',
      value: formatCurrency(stats?.overdue || 0),
      icon: AlertCircle,
      color: 'bg-red-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-blue-600" />
        <h1 className="text-2xl font-bold">CUSA Billing Dashboard</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 dark:text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Bills */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Recent Bills</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Bill No</th>
                <th className="text-left px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Unit</th>
                <th className="text-left px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Tenant</th>
                <th className="text-right px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-center px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left px-6 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {bills?.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 font-mono text-sm font-medium dark:text-white">{bill.billNo}</td>
                  <td className="px-6 py-4 dark:text-gray-300">{bill.unit?.unitNo || '—'}</td>
                  <td className="px-6 py-4 dark:text-gray-300">{bill.tenant?.fullName || '—'}</td>
                  <td className="px-6 py-4 text-right font-mono font-medium dark:text-white">
                    {formatCurrency(bill.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_BADGE[bill.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {bill.dueDate ? format(new Date(bill.dueDate), 'MMM dd, yyyy') : '—'}
                  </td>
                </tr>
              ))}
              {(!bills || bills.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No bills found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
