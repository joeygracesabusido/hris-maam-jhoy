'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { WaterBill, TierBreakdown } from '@/hooks/use-water'
import { format } from 'date-fns'

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatNum(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

function getCookies() {
  if (typeof document === 'undefined') return { email: '' }
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)
  return { email: cookies.userEmail || '' }
}

export default function PrintBillPage() {
  const params = useParams()
  const [bill, setBill] = useState<WaterBill | null>(null)
  const [preparedBy, setPreparedBy] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const [billRes, usersRes] = await Promise.all([
          fetch(`/api/water/bills/${params.id}`),
          fetch('/api/users'),
        ])
        const billData = await billRes.json()
        const users = await usersRes.json()
        setBill(billData)

        const { email } = getCookies()
        const user = users.find((u: { email: string; name: string }) => u.email === email)
        setPreparedBy(user?.name || email || '')
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
    <div className="max-w-3xl mx-auto p-6 print:p-0 print:text-black dark:text-gray-200 dark:bg-gray-900 min-h-screen">
      {/* Company Header */}
      <div className="text-center mb-3 border-b dark:border-gray-700 pb-2">
        <h1 className="text-lg font-bold dark:text-white">CARIGARA LEISURE AND STAY CORP.</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">Water Billing</p>
      </div>

      <div className="text-center mb-3">
        <h2 className="text-sm font-bold border-b border-black dark:border-gray-600 inline-block px-3 pb-1 dark:text-white">WATER BILL</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bill No: {bill.billNo}</p>
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
            {bill.rate && (
              <p><span className="text-gray-500 dark:text-gray-400">Rate:</span> {bill.rate.name} ({bill.rate.rateType})</p>
            )}
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

      {/* Rate Breakdown */}
      {bill.rate && bill.tierBreakdown && bill.tierBreakdown.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">RATE BREAKDOWN ({bill.rate.name})</h3>
          <table className="w-full border dark:border-gray-700 text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border dark:border-gray-700 px-3 py-1 text-left dark:text-gray-300">Tier</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">Units (m³)</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">Rate</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.tierBreakdown.map((t: TierBreakdown, i: number) => (
                <tr key={i}>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">{t.label}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatNum(t.units)}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatCurrency(t.rate)}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatCurrency(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AMOUNT DUE</h3>
        <table className="w-full border dark:border-gray-700 text-sm">
          <tbody>
            <tr>
              <td className="border dark:border-gray-700 px-3 py-1.5 font-bold dark:text-white">Total Amount</td>
              <td className="border dark:border-gray-700 px-3 py-1.5 text-right font-bold dark:text-white">{formatCurrency(bill.totalAmount)}</td>
            </tr>
            <tr>
              <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-300">Amount Paid</td>
              <td className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">{formatCurrency(bill.amountPaid)}</td>
            </tr>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <td className="border dark:border-gray-700 px-3 py-1.5 font-bold dark:text-white">Balance Due</td>
              <td className={`border dark:border-gray-700 px-3 py-1.5 text-right font-bold dark:border-gray-700 ${bill.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {formatCurrency(bill.balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {bill.payments && bill.payments.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">PAYMENT HISTORY</h3>
          <table className="w-full border dark:border-gray-700 text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border dark:border-gray-700 px-3 py-1 text-left dark:text-gray-300">Date</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">Amount</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-left dark:text-gray-300">Method</th>
                <th className="border dark:border-gray-700 px-3 py-1 text-left dark:text-gray-300">Reference</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-300">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 text-right dark:text-gray-300">{formatCurrency(p.amount)}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-300">{p.paymentMethod}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-300">{p.referenceNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="border-t dark:border-gray-700 pt-2">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">Prepared by:</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{preparedBy}</p>
          </div>
          <div className="text-right text-xs text-gray-400 dark:text-gray-500">
            <p>Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body {
          background: white;
        }
        .dark body {
          background: #111827;
        }
        @media print {
          body {
            background: white !important;
            margin: 0;
            padding: 0;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  )
}
