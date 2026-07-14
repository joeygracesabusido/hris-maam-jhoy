import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { computeTieredAmount } from '@/lib/water-billing'

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

    let previousReadingDate: Date | null = null
    if (bill.reading) {
      const prevReading = await prisma.waterMeterReading.findFirst({
        where: {
          meterId: bill.meterId,
          readingDate: { lt: bill.reading.readingDate },
        },
        orderBy: { readingDate: 'desc' },
      })
      previousReadingDate = prevReading?.readingDate || null
    }

    // Find rate active during billing period
    const billingStart = new Date(bill.billingYear, bill.billingMonth - 1, 1)
    const billingEnd = new Date(bill.billingYear, bill.billingMonth, 0, 23, 59, 59)
    const rate = await prisma.waterRate.findFirst({
      where: {
        effectiveFrom: { lte: billingEnd },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: billingStart } },
        ],
      },
      include: { tiers: { orderBy: { sequence: 'asc' } } },
      orderBy: { effectiveFrom: 'desc' },
    })

    // Compute rate breakdown
    let tierBreakdown: { label: string; units: number; rate: number; amount: number }[] | null = null
    if (rate) {
      tierBreakdown = []
      if (rate.rateType === 'TIERED' && rate.tiers.length > 0) {
        let remaining = bill.consumption
        for (const tier of rate.tiers) {
          if (remaining <= 0) break
          const tierMax = tier.toUnit ?? Infinity
          const tierRange = tierMax - tier.fromUnit
          const tierUnits = Math.min(remaining, tierRange)
          tierBreakdown.push({
            label: tier.toUnit ? `${tier.fromUnit}-${tier.toUnit} m³` : `${tier.fromUnit}+ m³`,
            units: tierUnits,
            rate: tier.pricePerUnit,
            amount: tierUnits * tier.pricePerUnit,
          })
          remaining -= tierUnits
        }
      } else {
        // FLAT rate
        tierBreakdown.push({
          label: 'Flat Rate',
          units: bill.consumption,
          rate: bill.totalAmount / (bill.consumption || 1),
          amount: bill.totalAmount,
        })
      }
    }

    return NextResponse.json({ ...bill, previousReadingDate, rate, tierBreakdown })
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

    // Delete bill first, then journal entry (avoids relation constraint issues)
    await prisma.waterBill.delete({ where: { id: bill.id } })
    if (bill.journalEntryId) {
      await prisma.journalLine.deleteMany({ where: { entryId: bill.journalEntryId } })
      await prisma.journalEntry.delete({ where: { id: bill.journalEntryId } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error deleting bill:', error)
    return NextResponse.json({ error: `Failed to delete bill: ${msg}` }, { status: 500 })
  }
}
