'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CusaBill } from '@/hooks/use-cusa'
import { format } from 'date-fns'

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan-Mar)',
  2: 'Q2 (Apr-Jun)',
  3: 'Q3 (Jul-Sep)',
  4: 'Q4 (Oct-Dec)',
}

const STATUS_COLORS: Record<string, string> = {
  PAID: 'text-green-700 dark:text-green-400',
  UNPAID: 'text-yellow-700 dark:text-yellow-400',
  OVERDUE: 'text-red-700 dark:text-red-400',
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

export default function PrintCusaBillPage() {
  const params = useParams()
  const [bill, setBill] = useState<CusaBill | null>(null)
  const [preparedBy, setPreparedBy] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const [billRes, usersRes] = await Promise.all([
          fetch(`/api/cusa/bills/${params.id}`),
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

  if (loading) return <div className="p-8 text-center dark:text-white">Loading bill...</div>
  if (!bill) return <div className="p-8 text-center dark:text-white">Bill not found</div>

  return (
    <div className="max-w-3xl mx-auto p-6 print:p-0 print:text-black dark:text-gray-200 dark:bg-gray-900 min-h-screen">
      {/* Company Header */}
      <div className="text-center mb-3 border-b dark:border-gray-700 pb-2">
        <h1 className="text-lg font-bold dark:text-white">CARIGARA LEISURE AND STAY CORP.</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">Common Use Service Area Billing</p>
      </div>

      {/* Bill Title */}
      <div className="text-center mb-3">
        <h2 className="text-sm font-bold border-b border-black dark:border-gray-600 inline-block px-3 pb-1 dark:text-white">
          COMMON USE SERVICE AREA (CUSA) BILL
        </h2>
      </div>

      {/* Bill Number and Status */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Bill No:</p>
          <p className="font-mono font-bold dark:text-white">{bill.billNo}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status:</p>
          <p className={`font-bold ${STATUS_COLORS[bill.status] || ''}`}>{bill.status}</p>
        </div>
      </div>

      {/* Bill Information */}
      <div className="mb-3 border dark:border-gray-700 rounded-lg p-3">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 border-b dark:border-gray-700 pb-1">BILL INFORMATION</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Unit Number:</p>
            <p className="font-medium dark:text-white">{bill.unit?.unitNo || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Floor:</p>
            <p className="font-medium dark:text-white">{bill.unit?.floor || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Zone:</p>
            <p className="font-medium dark:text-white">{bill.unit?.zone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tenant Name:</p>
            <p className="font-medium dark:text-white">{bill.tenant?.fullName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Billing Period:</p>
            <p className="font-medium dark:text-white text-sm">{QUARTER_LABELS[bill.billingQuarter] || `Q${bill.billingQuarter}`} - {bill.billingYear}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Due Date:</p>
            <p className="font-medium dark:text-white text-sm">{format(new Date(bill.dueDate), 'MMM dd, yyyy')}</p>
          </div>
        </div>
      </div>

      {/* Amount Section */}
      <div className="mb-3">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AMOUNT DETAILS</h3>
        <table className="w-full border dark:border-gray-700 text-sm">
          <tbody>
            <tr className="dark:border-gray-700">
              <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">Unit Area (sq.m.)</td>
              <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{bill.areaSqm.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr className="dark:border-gray-700">
              <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">Rate per Sq.m.</td>
              <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatCurrency(bill.ratePerSqm)}</td>
            </tr>
            <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
              <td className="border dark:border-gray-600 px-3 py-1.5 dark:text-white">Total Amount Due</td>
              <td className="border dark:border-gray-600 px-3 py-1.5 text-right font-mono dark:text-white">{formatCurrency(bill.totalAmount)}</td>
            </tr>
            <tr className="dark:border-gray-700">
              <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">Amount Paid</td>
              <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatCurrency(bill.amountPaid)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border dark:border-gray-700 px-3 py-1 dark:text-white">Balance Due</td>
              <td className={`border dark:border-gray-700 px-3 py-1 text-right font-mono ${bill.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {formatCurrency(bill.balance)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment History */}
      <div className="mb-3">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">PAYMENT HISTORY</h3>
        {bill.payments && bill.payments.length > 0 ? (
          <table className="w-full border dark:border-gray-700 text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border dark:border-gray-600 px-3 py-1 text-left dark:text-gray-200">Date</th>
                <th className="border dark:border-gray-600 px-3 py-1 text-right dark:text-gray-200">Amount</th>
                <th className="border dark:border-gray-600 px-3 py-1 text-left dark:text-gray-200">Method</th>
                <th className="border dark:border-gray-600 px-3 py-1 text-left dark:text-gray-200">Reference No.</th>
                <th className="border dark:border-gray-600 px-3 py-1 text-left dark:text-gray-200">Status</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 text-right font-mono dark:text-white">{formatCurrency(p.amount)}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">{p.paymentMethod}</td>
                  <td className="border dark:border-gray-700 px-3 py-1 dark:text-gray-200">{p.referenceNo || '—'}</td>
                  <td className="border dark:border-gray-700 px-3 py-1">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">COMPLETED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 dark:text-gray-500 border dark:border-gray-700 rounded py-2 text-sm">No payments recorded</p>
        )}
      </div>

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

      {/* Print-specific styles */}
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
