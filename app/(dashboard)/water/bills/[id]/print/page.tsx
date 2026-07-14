'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { WaterBill } from '@/hooks/use-water'
import { format } from 'date-fns'

function formatBillingPeriod(bill: WaterBill & { previousReadingDate?: string }): string {
  if (bill.previousReadingDate && bill.reading?.readingDate) {
    const from = format(new Date(bill.previousReadingDate), 'MMM dd')
    const to = format(new Date(bill.reading.readingDate), 'MMM dd, yyyy')
    return `${from} to ${to}`
  }
  const firstDay = new Date(bill.billingYear, bill.billingMonth - 1, 1)
  const lastDay = new Date(bill.billingYear, bill.billingMonth, 0)
  return `${format(firstDay, 'MMM d')}-${format(lastDay, 'd, yyyy')}`
}

export default function PrintBillPage() {
  const params = useParams()
  const [bill, setBill] = useState<WaterBill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await fetch(`/api/water/bills/${params.id}`)
        const data = await res.json()
        setBill(data)
      } catch (err) {
        console.error('Failed to fetch bill:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBill()
  }, [params.id])

  useEffect(() => {
    if (!loading && bill) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, bill])

  if (loading) return <div className="p-8 text-center dark:text-gray-300">Loading bill...</div>
  if (!bill) return <div className="p-8 text-center dark:text-gray-300">Bill not found</div>

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 dark:bg-gray-900">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold dark:text-white">WATER BILL</h1>
        <p className="text-gray-500 dark:text-gray-400">Bill No: {bill.billNo}</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1 dark:text-gray-400">Bill To</h3>
          <p className="font-medium dark:text-white">{bill.tenant?.fullName || 'N/A'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{bill.tenant?.unitNo || ''}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{bill.tenant?.address || ''}</p>
        </div>
        <div className="text-right">
          <div className="space-y-1 dark:text-gray-300">
            <p><span className="text-gray-500 dark:text-gray-400">Billing Period:</span> {formatBillingPeriod(bill)}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Due Date:</span> {format(new Date(bill.dueDate), 'MMM dd, yyyy')}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Meter No.:</span> {bill.meter?.meterNo || 'N/A'}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Status:</span> {bill.status}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-500 mb-2 dark:text-gray-400">Meter Reading</h3>
        <table className="w-full border dark:border-gray-700">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Previous Reading</th>
              <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Current Reading</th>
              <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Consumption (m³)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-4 py-2 font-mono text-lg dark:text-white dark:border-gray-700">{bill.previousReading.toFixed(1)}</td>
              <td className="border px-4 py-2 font-mono text-lg dark:text-white dark:border-gray-700">{bill.currentReading.toFixed(1)}</td>
              <td className="border px-4 py-2 font-mono text-lg font-bold dark:text-white dark:border-gray-700">{bill.consumption.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-500 mb-2 dark:text-gray-400">Amount Due</h3>
        <table className="w-full border dark:border-gray-700">
          <tbody>
            <tr>
              <td className="border px-4 py-3 font-bold dark:text-white dark:border-gray-700">Total Amount</td>
              <td className="border px-4 py-3 text-right font-bold text-lg dark:text-white dark:border-gray-700">₱{bill.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border px-4 py-3 dark:text-gray-300 dark:border-gray-700">Amount Paid</td>
              <td className="border px-4 py-3 text-right dark:text-gray-300 dark:border-gray-700">₱{bill.amountPaid.toFixed(2)}</td>
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <td className="border px-4 py-3 font-bold text-lg dark:text-white dark:border-gray-700">Balance Due</td>
              <td className={`border px-4 py-3 text-right font-bold text-lg dark:border-gray-700 ${bill.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                ₱{bill.balance.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {bill.payments && bill.payments.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-500 mb-2 dark:text-gray-400">Payment History</h3>
          <table className="w-full border dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Date</th>
                <th className="border px-4 py-2 text-right dark:text-gray-300 dark:border-gray-700">Amount</th>
                <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Method</th>
                <th className="border px-4 py-2 text-left dark:text-gray-300 dark:border-gray-700">Reference</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="border px-4 py-2 dark:text-gray-300 dark:border-gray-700">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                  <td className="border px-4 py-2 text-right dark:text-gray-300 dark:border-gray-700">₱{p.amount.toFixed(2)}</td>
                  <td className="border px-4 py-2 dark:text-gray-300 dark:border-gray-700">{p.paymentMethod}</td>
                  <td className="border px-4 py-2 dark:text-gray-300 dark:border-gray-700">{p.referenceNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center text-sm text-gray-400 mt-12 print:mt-8 dark:text-gray-500">
        <p>Thank you for your payment. Please pay on or before the due date.</p>
      </div>
    </div>
  )
}
