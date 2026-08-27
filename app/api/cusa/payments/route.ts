import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { retryableTransaction } from '@/lib/prisma-transaction'
import {
  generateCusaPaymentNo,
  getNextCusaPaymentSequence,
  getManilaDate,
} from '@/lib/cusa-billing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const billId = searchParams.get('billId')
    const method = searchParams.get('method')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (billId) where.billId = billId
    if (method) where.paymentMethod = method

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)
      where.paymentDate = dateFilter
    }

    const payments = await prisma.cusaPayment.findMany({
      where,
      include: {
        bill: {
          include: { unit: true, tenant: true },
        },
      },
      orderBy: { paymentDate: 'desc' },
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error fetching CUSA payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { billId, amount, paymentDate, paymentMethod, referenceNo, notes } = body

    if (!billId || !amount || !paymentDate || !paymentMethod) {
      return NextResponse.json(
        { error: 'billId, amount, paymentDate, and paymentMethod are required' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    const paymentDateObj = new Date(paymentDate)
    if (isNaN(paymentDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid paymentDate format' }, { status: 400 })
    }

    const bill = await prisma.cusaBill.findUnique({ where: { id: billId } })
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    if (bill.status === 'PAID') {
      return NextResponse.json({ error: 'Bill is already fully paid' }, { status: 400 })
    }

    const tolerance = 0.01
    if (Math.abs(amount - bill.totalAmount) > tolerance) {
      return NextResponse.json(
        { error: `Full payment required. Bill total: ${bill.totalAmount}, received: ${amount}` },
        { status: 400 }
      )
    }

    const manilaDate = getManilaDate()
    const sequence = await getNextCusaPaymentSequence(manilaDate)
    const paymentNo = generateCusaPaymentNo(manilaDate, sequence)

    const result = await retryableTransaction(async (tx) => {
      const payment = await tx.cusaPayment.create({
        data: {
          billId,
          paymentNo,
          amount,
          paymentDate: paymentDateObj,
          paymentMethod,
          referenceNo: referenceNo || null,
          notes: notes || null,
        },
      })

      await tx.cusaBill.update({
        where: { id: billId },
        data: {
          amountPaid: bill.totalAmount,
          balance: 0,
          status: 'PAID',
        },
      })

      return tx.cusaPayment.findUnique({
        where: { id: payment.id },
        include: {
          bill: {
            include: { unit: true, tenant: true },
          },
        },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating CUSA payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
