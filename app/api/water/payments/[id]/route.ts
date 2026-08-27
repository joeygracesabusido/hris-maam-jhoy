import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { retryableTransaction } from '@/lib/prisma-transaction'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const payment = await prisma.waterPayment.findUnique({
      where: { id: params.id },
      include: {
        bill: {
          include: { tenant: true, meter: true },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const payment = await prisma.waterPayment.findUnique({
      where: { id: params.id },
      include: { bill: true },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    await retryableTransaction(async (tx) => {
      // Void journal entry if exists
      if (payment.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: payment.journalEntryId },
          data: { status: 'VOID' },
        })
      }

      // Delete payment
      await tx.waterPayment.delete({ where: { id: params.id } })

      // Recalculate bill balance
      const newAmountPaid = Math.max(0, payment.bill.amountPaid - payment.amount)
      const newBalance = payment.bill.totalAmount - newAmountPaid
      const newStatus = newBalance <= 0 ? (newAmountPaid > 0 ? 'PAID' : 'UNPAID') : 'PARTIAL'

      await tx.waterBill.update({
        where: { id: payment.billId },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}
