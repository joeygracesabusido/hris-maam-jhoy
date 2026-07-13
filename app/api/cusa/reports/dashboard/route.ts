import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')

    const currentYear = new Date().getFullYear()

    const where: Record<string, unknown> = { billingYear: currentYear }
    if (branchId && branchId !== 'all') {
      where.branchId = branchId
    }

    const bills = await prisma.cusaBill.findMany({
      where,
      select: {
        totalAmount: true,
        amountPaid: true,
        status: true,
        dueDate: true,
      },
    })

    const now = new Date()
    let totalBilled = 0
    let collected = 0
    let overdue = 0

    for (const bill of bills) {
      totalBilled += bill.totalAmount
      collected += bill.amountPaid

      if (bill.status === 'UNPAID' && bill.dueDate < now) {
        overdue += bill.totalAmount - bill.amountPaid
      }
    }

    const outstanding = totalBilled - collected

    return NextResponse.json({
      totalBilled,
      collected,
      outstanding,
      overdue,
    })
  } catch (error) {
    console.error('Error fetching CUSA dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
