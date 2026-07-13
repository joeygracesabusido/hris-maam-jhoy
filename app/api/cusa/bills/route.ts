import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  findApplicableTier,
  computeCusaAmount,
  generateCusaBillNo,
  getNextCusaBillSequence,
} from '@/lib/cusa-billing'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const quarter = searchParams.get('quarter')
    const year = searchParams.get('year')
    const unitId = searchParams.get('unitId')
    const branchId = searchParams.get('branchId')
    const limit = searchParams.get('limit')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (quarter) where.billingQuarter = parseInt(quarter)
    if (year) where.billingYear = parseInt(year)
    if (unitId) where.unitId = unitId
    if (branchId && branchId !== 'all') where.branchId = branchId

    // Validate and cap limit
    const parsedLimit = limit ? parseInt(limit) : undefined
    if (parsedLimit && (isNaN(parsedLimit) || parsedLimit < 1)) {
      return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
    }
    const cappedLimit = parsedLimit ? Math.min(parsedLimit, 100) : undefined

    const bills = await prisma.cusaBill.findMany({
      where,
      include: {
        unit: true,
        tenant: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
      orderBy: [{ billingYear: 'desc' }, { billingQuarter: 'desc' }, { billNo: 'desc' }],
      ...(cappedLimit ? { take: cappedLimit } : {}),
    })

    return NextResponse.json(bills)
  } catch (error) {
    console.error('Error fetching CUSA bills:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA bills' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { billingQuarter, billingYear, dueDate, branchId } = body

    if (!billingQuarter || !billingYear || !dueDate) {
      return NextResponse.json(
        { error: 'billingQuarter, billingYear, and dueDate are required' },
        { status: 400 }
      )
    }

    if (billingQuarter < 1 || billingQuarter > 4) {
      return NextResponse.json({ error: 'billingQuarter must be 1-4' }, { status: 400 })
    }

    if (billingYear < 2000 || billingYear > 2100) {
      return NextResponse.json({ error: 'billingYear must be between 2000 and 2100' }, { status: 400 })
    }

    // Validate dueDate is a valid date
    const dueDateObj = new Date(dueDate)
    if (isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid dueDate format' }, { status: 400 })
    }

    // Validate branch exists if provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }
    }

    // 1. Find active rate for the billing period
    const rateWhere: Record<string, unknown> = { isActive: true }
    if (branchId) rateWhere.branchId = branchId

    const rate = await prisma.cusaRate.findFirst({
      where: rateWhere,
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    if (!rate) {
      return NextResponse.json(
        { error: 'No active CUSA rate found for the billing period' },
        { status: 400 }
      )
    }

    if (!rate.tiers || rate.tiers.length === 0) {
      return NextResponse.json(
        { error: 'Active rate has no tiers configured' },
        { status: 400 }
      )
    }

    // 2. Fetch occupied units for branch
    const unitWhere: Record<string, unknown> = { status: 'OCCUPIED' }
    if (branchId) unitWhere.branchId = branchId

    const units = await prisma.cusaUnit.findMany({
      where: unitWhere,
      include: { tenant: true },
    })

    if (units.length === 0) {
      return NextResponse.json(
        { error: 'No occupied units found for the specified branch' },
        { status: 400 }
      )
    }

    // 3. Check which units already have bills for this quarter
    const existingBills = await prisma.cusaBill.findMany({
      where: {
        billingQuarter,
        billingYear,
        ...(branchId ? { branchId } : {}),
      },
      select: { unitId: true },
    })

    const billedUnitIds = new Set(existingBills.map((b) => b.unitId))

    // 4. Pre-compute sequences for unbilled units (outside transaction to avoid race conditions)
    const unbilledUnits = units.filter((u) => !billedUnitIds.has(u.id))
    const validUnits = unbilledUnits
      .map((u) => ({ unit: u, tier: findApplicableTier(u.areaSqm, rate.tiers) }))
      .filter((entry): entry is { unit: typeof units[number]; tier: NonNullable<ReturnType<typeof findApplicableTier>> } => entry.tier !== null)

    if (validUnits.length === 0) {
      return NextResponse.json(
        { error: 'No units match the rate tiers for billing' },
        { status: 400 }
      )
    }

    let currentSequence = await getNextCusaBillSequence(billingYear, billingQuarter)

    const createdBills = await prisma.$transaction(async (tx) => {
      const bills = []
      for (const { unit, tier } of validUnits) {
        const totalAmount = computeCusaAmount(unit.areaSqm, tier.pricePerSqm)
        const sequence = currentSequence++
        const billNo = generateCusaBillNo(billingYear, billingQuarter, sequence)

        const bill = await tx.cusaBill.create({
          data: {
            billNo,
            unitId: unit.id,
            tenantId: unit.tenantId,
            rateId: rate.id,
            billingQuarter,
            billingYear,
            areaSqm: unit.areaSqm,
            ratePerSqm: tier.pricePerSqm,
            totalAmount,
            balance: totalAmount,
            dueDate: dueDateObj,
            status: 'UNPAID',
            branchId: unit.branchId || null,
          },
          include: {
            unit: true,
            tenant: true,
            rate: true,
          },
        })

        bills.push(bill)
      }
      return bills
    })

    return NextResponse.json({
      generated: createdBills.length,
      skipped: billedUnitIds.size,
      bills: createdBills,
    }, { status: 201 })
  } catch (error) {
    console.error('Error generating CUSA bills:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to generate bills: ${message}` }, { status: 500 })
  }
}
