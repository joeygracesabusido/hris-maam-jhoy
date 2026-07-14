import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const bill = await prisma.cusaBill.findUnique({
      where: { id: params.id },
      include: {
        unit: true,
        tenant: true,
        rate: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'CUSA bill not found' }, { status: 404 })
    }

    return NextResponse.json(bill)
  } catch (error) {
    console.error('Error fetching CUSA bill:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA bill' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    const validStatuses = ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await prisma.cusaBill.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'CUSA bill not found' }, { status: 404 })
    }

    if (existing.status === 'VOID' && status !== 'VOID') {
      return NextResponse.json(
        { error: 'Cannot change status of a voided bill' },
        { status: 400 }
      )
    }

    const bill = await prisma.cusaBill.update({
      where: { id: params.id },
      data: { status },
      include: {
        unit: true,
        tenant: true,
        rate: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    })

    return NextResponse.json(bill)
  } catch (error) {
    console.error('Error updating CUSA bill:', error)
    return NextResponse.json({ error: 'Failed to update CUSA bill' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.cusaBill.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'CUSA bill not found' }, { status: 404 })
    }

    if (existing.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot delete a paid bill' },
        { status: 400 }
      )
    }

    await prisma.cusaBill.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting CUSA bill:', error)
    return NextResponse.json({ error: 'Failed to delete CUSA bill' }, { status: 500 })
  }
}
