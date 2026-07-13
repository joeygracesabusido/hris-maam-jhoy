import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')

    const now = new Date()

    const where: Record<string, unknown> = {
      status: 'UNPAID',
      dueDate: { lt: now },
    }
    if (branchId && branchId !== 'all') {
      where.branchId = branchId
    }

    const bills = await prisma.cusaBill.findMany({
      where,
      include: {
        unit: true,
        tenant: true,
      },
      orderBy: { dueDate: 'asc' },
    })

    const overdueBills = bills.map((bill) => {
      const diffMs = now.getTime() - bill.dueDate.getTime()
      const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      return {
        id: bill.id,
        billNo: bill.billNo,
        billingQuarter: bill.billingQuarter,
        billingYear: bill.billingYear,
        totalAmount: bill.totalAmount,
        amountPaid: bill.amountPaid,
        balance: bill.balance,
        dueDate: bill.dueDate,
        daysOverdue,
        unit: bill.unit,
        tenant: bill.tenant,
      }
    })

    return NextResponse.json(overdueBills)
  } catch (error) {
    console.error('Error fetching overdue CUSA bills:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overdue bills' },
      { status: 500 }
    )
  }
}
