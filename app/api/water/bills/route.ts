import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { computeTieredAmount, generateBillNo, getNextBillSequence, getServiceIncomeAccount, getAccountsReceivableAccount } from '@/lib/water-billing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (month) where.billingMonth = parseInt(month)
    if (year) where.billingYear = parseInt(year)
    if (status) where.status = status
    if (branchId && branchId !== 'all') where.branchId = branchId

    const bills = await prisma.waterBill.findMany({
      where,
      include: {
        tenant: true,
        meter: true,
        reading: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }, { billNo: 'desc' }],
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error('Error fetching bills:', error)
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { billingMonth, billingYear, rateId, dueDate, meterIds, branchId } = body

    if (!billingMonth || !billingYear || !rateId || !dueDate) {
      return NextResponse.json({ error: 'Billing month, year, rate ID, and due date are required' }, { status: 400 })
    }

    const rate = await prisma.waterRate.findUnique({
      where: { id: rateId },
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    if (!rate || !rate.isActive) {
      return NextResponse.json({ error: 'Rate not found or inactive' }, { status: 400 })
    }

    const now = new Date()
    const readingStart = new Date(billingYear, billingMonth - 1, 1)
    const readingEnd = new Date(billingYear, billingMonth, 0, 23, 59, 59)

    const meterWhere: Record<string, unknown> = { status: 'ACTIVE' }
    if (meterIds && meterIds.length > 0) {
      meterWhere.id = { in: meterIds }
    }
    if (branchId && branchId !== 'all') {
      meterWhere.branchId = branchId
    }

    const meters = await prisma.waterMeter.findMany({
      where: meterWhere,
      include: { tenant: true },
    })

    if (meters.length === 0) {
      return NextResponse.json({ error: 'No active meters found for billing' }, { status: 400 })
    }

    const serviceIncomeId = await getServiceIncomeAccount()
    const arAccountId = await getAccountsReceivableAccount()

    if (!serviceIncomeId || !arAccountId) {
      return NextResponse.json({ error: 'Required accounts not found (4120 Service Income, 1200 AR). Run COA seed first.' }, { status: 400 })
    }

    let sequence = await getNextBillSequence(billingYear, billingMonth)
    const createdBills = []

    for (const meter of meters) {
      if (!meter.tenantId) continue

      const existingBill = await prisma.waterBill.findFirst({
        where: {
          meterId: meter.id,
          billingMonth,
          billingYear,
          status: { notIn: ['DRAFT', 'WRITTEN_OFF'] },
        },
      })

      if (existingBill) continue

      const reading = await prisma.waterMeterReading.findFirst({
        where: {
          meterId: meter.id,
          readingDate: { gte: readingStart, lte: readingEnd },
        },
        orderBy: { readingDate: 'desc' },
      })

      if (!reading || reading.consumption <= 0) continue

      let totalAmount: number
      if (rate.rateType === 'FLAT') {
        const flatTier = rate.tiers[0]
        totalAmount = flatTier ? flatTier.pricePerUnit : 0
      } else {
        totalAmount = computeTieredAmount(
          reading.consumption,
          rate.tiers.map(t => ({
            fromUnit: t.fromUnit,
            toUnit: t.toUnit,
            pricePerUnit: t.pricePerUnit,
            sequence: t.sequence,
          }))
        )
      }

      const billNo = generateBillNo(billingYear, billingMonth, sequence)
      sequence++

      const bill = await prisma.$transaction(async (tx) => {
        const newBill = await tx.waterBill.create({
          data: {
            billNo,
            tenantId: meter.tenantId!,
            meterId: meter.id,
            readingId: reading.id,
            billingMonth,
            billingYear,
            previousReading: reading.previousReading,
            currentReading: reading.currentReading,
            consumption: reading.consumption,
            totalAmount,
            amountPaid: 0,
            balance: totalAmount,
            dueDate: new Date(dueDate),
            status: 'UNPAID',
            branchId: branchId || null,
          },
        })

        const je = await tx.journalEntry.create({
          data: {
            date: now,
            description: `Water bill ${billNo} - ${meter.tenant?.fullName || 'Tenant'} - ${billingMonth}/${billingYear}`,
            reference: `WTR-BILL-${billNo}`,
            status: 'POSTED',
            branchId: branchId || null,
            lines: {
              create: [
                {
                  accountId: arAccountId,
                  debit: totalAmount,
                  credit: 0,
                  memo: `Water bill ${billNo}`,
                },
                {
                  accountId: serviceIncomeId,
                  debit: 0,
                  credit: totalAmount,
                  memo: `Water bill ${billNo}`,
                },
              ],
            },
          },
        })

        await tx.waterBill.update({
          where: { id: newBill.id },
          data: { journalEntryId: je.id },
        })

        return tx.waterBill.findUnique({
          where: { id: newBill.id },
          include: { tenant: true, meter: true, reading: true },
        })
      })

      createdBills.push(bill)
    }

    if (createdBills.length === 0) {
      return NextResponse.json({ message: 'No new bills generated. All meters already billed or have no readings.' }, { status: 200 })
    }

    return NextResponse.json(createdBills, { status: 201 })
  } catch (error) {
    console.error('Error generating bills:', error)
    return NextResponse.json({ error: 'Failed to generate bills' }, { status: 500 })
  }
}
