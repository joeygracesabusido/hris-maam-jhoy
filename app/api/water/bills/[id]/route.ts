import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const bill = await prisma.waterBill.findUnique({
      where: { id: params.id },
      include: {
        tenant: true,
        meter: true,
        reading: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        journalEntry: {
          include: { lines: { include: { account: true } } },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    return NextResponse.json(bill)
  } catch (error) {
    console.error('Error fetching bill:', error)
    return NextResponse.json({ error: 'Failed to fetch bill' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    if (body.status === 'VOID' || body.status === 'WRITTEN_OFF') {
      return await voidBill(params.id, body.status)
    }

    const bill = await prisma.waterBill.update({
      where: { id: params.id },
      data: {
        status: body.status,
        totalAmount: body.totalAmount,
        amountPaid: body.amountPaid,
        balance: body.balance !== undefined ? body.balance : (body.totalAmount !== undefined ? body.totalAmount - (body.amountPaid ?? 0) : undefined),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
    })

    return NextResponse.json(bill)
  } catch (error) {
    console.error('Error updating bill:', error)
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 })
  }
}

async function voidBill(id: string, status: string) {
  const bill = await prisma.waterBill.findUnique({
    where: { id },
    include: { journalEntry: true },
  })

  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }

  if (bill.amountPaid > 0) {
    return NextResponse.json(
      { error: 'Cannot void a bill with payments. Delete payments first.' },
      { status: 400 }
    )
  }

  await prisma.$transaction(async (tx) => {
    if (bill.journalEntryId) {
      await tx.journalEntry.update({
        where: { id: bill.journalEntryId },
        data: { status: 'VOID' },
      })
    }

    await tx.waterBill.update({
      where: { id },
      data: { status },
    })
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const bill = await prisma.waterBill.findUnique({
      where: { id: params.id },
      include: { payments: true },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    if (bill.payments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete bill with payments. Void the bill instead.' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (bill.journalEntryId) {
        await tx.journalLine.deleteMany({ where: { entryId: bill.journalEntryId } })
        await tx.journalEntry.delete({ where: { id: bill.journalEntryId } })
      }
      await tx.waterBill.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bill:', error)
    return NextResponse.json({ error: 'Failed to delete bill' }, { status: 500 })
  }
}
