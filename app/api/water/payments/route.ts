import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCashAccount, getAccountsReceivableAccount } from '@/lib/water-billing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const billId = searchParams.get('billId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (billId) where.billId = billId

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.paymentDate = dateFilter
    }

    const payments = await prisma.waterPayment.findMany({
      where,
      include: {
        bill: {
          include: { tenant: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { billId, amount, paymentDate, paymentMethod, referenceNo, notes } = body

    if (!billId || !amount || !paymentDate) {
      return NextResponse.json({ error: 'Bill ID, amount, and payment date are required' }, { status: 400 })
    }

    const bill = await prisma.waterBill.findUnique({ where: { id: billId } })
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    if (bill.status === 'PAID') {
      return NextResponse.json({ error: 'Bill is already fully paid' }, { status: 400 })
    }

    const newAmountPaid = Math.min(bill.amountPaid + amount, bill.totalAmount)
    const newBalance = bill.totalAmount - newAmountPaid
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL'

    const cashAccountId = await getCashAccount()
    const arAccountId = await getAccountsReceivableAccount()

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.waterPayment.create({
        data: {
          billId,
          amount,
          paymentDate: new Date(paymentDate),
          paymentMethod: paymentMethod || 'CASH',
          referenceNo,
          notes,
        },
      })

      await tx.waterBill.update({
        where: { id: billId },
        data: {
          amountPaid: newAmountPaid,
          balance: newBalance,
          status: newStatus,
        },
      })

      if (cashAccountId && arAccountId) {
        const je = await tx.journalEntry.create({
          data: {
            date: new Date(paymentDate),
            description: `Water payment - ${bill.billNo} - ${bill.id}`,
            reference: `WTR-PMT-${payment.id.substring(0, 8)}`,
            status: 'POSTED',
            branchId: bill.branchId,
            lines: {
              create: [
                {
                  accountId: cashAccountId,
                  debit: amount,
                  credit: 0,
                  memo: `Water payment ${bill.billNo}`,
                },
                {
                  accountId: arAccountId,
                  debit: 0,
                  credit: amount,
                  memo: `Water payment ${bill.billNo}`,
                },
              ],
            },
          },
        })

        await tx.waterPayment.update({
          where: { id: payment.id },
          data: { journalEntryId: je.id },
        })
      }

      return tx.waterPayment.findUnique({
        where: { id: payment.id },
        include: { bill: { include: { tenant: true } } },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
