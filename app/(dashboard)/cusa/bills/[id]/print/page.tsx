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
  PAID: 'text-green-700',
  UNPAID: 'text-yellow-700',
  OVERDUE: 'text-red-700',
}

export default function PrintCusaBillPage() {
  const params = useParams()
  const [bill, setBill] = useState<CusaBill | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await fetch(`/api/cusa/bills/${params.id}`)
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

  if (loading) return <div className="p-8 text-center">Loading bill...</div>
  if (!bill) return <div className="p-8 text-center">Bill not found</div>

  return (
    <div className="max-w-3xl mx-auto p-8 print:p-0 print:text-black">
      {/* Company Header */}
      <div className="text-center mb-6 border-b pb-4">
        <h1 className="text-xl font-bold">MA&apos;AM JHOY PROPERTIES</h1>
        <p className="text-sm text-gray-600">Common Use Service Area Billing</p>
      </div>

      {/* Bill Title */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold border-b-2 border-black inline-block px-4 pb-1">
          COMMON USE SERVICE AREA (CUSA) BILL
        </h2>
      </div>

      {/* Bill Number and Status */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm text-gray-500">Bill No:</p>
          <p className="font-mono font-bold text-lg">{bill.billNo}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Status:</p>
          <p className={`font-bold text-lg ${STATUS_COLORS[bill.status] || ''}`}>{bill.status}</p>
        </div>
      </div>

      {/* Bill Information */}
      <div className="mb-6 border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-3 border-b pb-1">BILL INFORMATION</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Unit Number:</p>
            <p className="font-medium">{bill.unit?.unitNo || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Floor:</p>
            <p className="font-medium">{bill.unit?.floor || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Zone:</p>
            <p className="font-medium">{bill.unit?.zone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tenant Name:</p>
            <p className="font-medium">{bill.tenant?.fullName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Billing Period:</p>
            <p className="font-medium">{QUARTER_LABELS[bill.billingQuarter] || `Q${bill.billingQuarter}`} - {bill.billingYear}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Due Date:</p>
            <p className="font-medium">{format(new Date(bill.dueDate), 'MMM dd, yyyy')}</p>
          </div>
        </div>
      </div>

      {/* Amount Section */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">AMOUNT DETAILS</h3>
        <table className="w-full border">
          <tbody>
            <tr>
              <td className="border px-4 py-2">Unit Area (sq.m.)</td>
              <td className="border px-4 py-2 text-right font-mono">{bill.areaSqm.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">Rate per Sq.m.</td>
              <td className="border px-4 py-2 text-right font-mono">₱{bill.ratePerSqm.toFixed(2)}</td>
            </tr>
            <tr className="bg-gray-100 font-bold">
              <td className="border px-4 py-3">Total Amount Due</td>
              <td className="border px-4 py-3 text-right font-mono text-lg">₱{bill.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">Amount Paid</td>
              <td className="border px-4 py-2 text-right font-mono">₱{bill.amountPaid.toFixed(2)}</td>
            </tr>
            <tr className="font-bold">
              <td className="border px-4 py-2">Balance Due</td>
              <td className={`border px-4 py-2 text-right font-mono text-lg ${bill.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₱{bill.balance.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment History */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">PAYMENT HISTORY</h3>
        {bill.payments && bill.payments.length > 0 ? (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-4 py-2 text-left">Date</th>
                <th className="border px-4 py-2 text-right">Amount</th>
                <th className="border px-4 py-2 text-left">Method</th>
                <th className="border px-4 py-2 text-left">Reference No.</th>
                <th className="border px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="border px-4 py-2">{format(new Date(p.paymentDate), 'MMM dd, yyyy')}</td>
                  <td className="border px-4 py-2 text-right font-mono">₱{p.amount.toFixed(2)}</td>
                  <td className="border px-4 py-2">{p.paymentMethod}</td>
                  <td className="border px-4 py-2">{p.referenceNo || '—'}</td>
                  <td className="border px-4 py-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">COMPLETED</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center text-gray-400 border rounded py-4">No payments recorded</p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 mt-12 print:mt-8 border-t pt-4">
        <p>Thank you for your payment. Please pay on or before the due date.</p>
        <p className="mt-2 text-xs">Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:mt-8 {
            margin-top: 2rem !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
