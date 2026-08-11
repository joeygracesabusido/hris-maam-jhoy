import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  findApplicableTier,
  computeCusaAmount,
  generateCusaBillNo,
  getNextCusaBillSequence,
  getQuarterDates,
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
    const { billingQuarter, billingYear, billingMonth, dueDate, billingMonths, branchId, unitIds } = body

    if (!billingQuarter || !billingYear || !dueDate) {
      return NextResponse.json(
        { error: 'billingQuarter, billingYear, and dueDate are required' },
        { status: 400 }
      )
    }

    if (billingQuarter < 1 || billingQuarter > 4) {
      return NextResponse.json({ error: 'billingQuarter must be 1-4' }, { status: 400 })
    }

    // Starting month must be 1-12 when provided; fall back to the quarter's first month
    // for requests that don't send it (backward compatibility).
    const startMonth = billingMonth ?? (billingQuarter - 1) * 3 + 1
    if (startMonth < 1 || startMonth > 12) {
      return NextResponse.json({ error: 'billingMonth must be 1-12' }, { status: 400 })
    }

    if (billingYear < 2000 || billingYear > 2100) {
      return NextResponse.json({ error: 'billingYear must be between 2000 and 2100' }, { status: 400 })
    }

    const months = billingMonths || 3
    if (months < 1 || months > 3) {
      return NextResponse.json({ error: 'billingMonths must be 1-3' }, { status: 400 })
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

    // 1. Find active rate for the billing period (validate effective dates)
    const { start: quarterStart, end: quarterEnd } = getQuarterDates(billingQuarter, billingYear)

    const rateWhere: Record<string, unknown> = {
      isActive: true,
      effectiveFrom: { lte: quarterEnd },
    }
    if (branchId) rateWhere.branchId = branchId

    // Fetch all candidate rates and filter in-memory for effectiveTo (supports null and date range)
    const candidateRates = await prisma.cusaRate.findMany({
      where: rateWhere,
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    const rate = candidateRates.find((r) => {
      if (!r.effectiveTo) return true // No end date = forever active
      return r.effectiveTo >= quarterStart
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
    if (unitIds && Array.isArray(unitIds) && unitIds.length > 0) {
      unitWhere.id = { in: unitIds }
    }

    console.log('[CUSA Bills] unitWhere:', JSON.stringify(unitWhere))
    const units = await prisma.cusaUnit.findMany({
      where: unitWhere,
      include: { tenant: true },
    })
    console.log('[CUSA Bills] fetched units:', units.length, units.map(u => `${u.unitNo}(${u.id}) area=${u.areaSqm} lease=${u.leaseStart}-${u.leaseEnd}`))

    if (units.length === 0) {
      return NextResponse.json(
        { error: 'No occupied units found for the specified selection' },
        { status: 400 }
      )
    }

    // 3. Filter by lease dates — only bill units that were occupied during the quarter
    console.log('[CUSA Bills] quarterStart:', quarterStart, 'quarterEnd:', quarterEnd)
    const leasedUnits = units.filter((u) => {
      if (u.leaseStart && u.leaseStart > quarterEnd) return false
      if (u.leaseEnd && u.leaseEnd < quarterStart) return false
      return true
    })
    console.log('[CUSA Bills] leasedUnits:', leasedUnits.length, leasedUnits.map(u => u.unitNo))

    if (leasedUnits.length === 0) {
      return NextResponse.json(
        { error: 'No occupied units with active leases found for this quarter' },
        { status: 400 }
      )
    }

    // 4. Check which units already have bills for this quarter
    const existingBills = await prisma.cusaBill.findMany({
      where: {
        billingQuarter,
        billingYear,
        ...(branchId ? { branchId } : {}),
      },
      select: { unitId: true, billNo: true },
    })
    console.log('[CUSA Bills] existing bills:', existingBills.length, existingBills.map(b => `${b.billNo}(${b.unitId})`))

    const billedUnitIds = new Set(existingBills.map((b) => b.unitId))

    // Pre-compute sequences for unbilled units (outside transaction to avoid race conditions)
    const unbilledUnits = leasedUnits.filter((u) => !billedUnitIds.has(u.id))
    console.log('[CUSA Bills] unbilledUnits:', unbilledUnits.length, unbilledUnits.map(u => `${u.unitNo}(${u.id}) area=${u.areaSqm}`))

    if (unbilledUnits.length === 0) {
      return NextResponse.json({
        generated: 0,
        skipped: billedUnitIds.size,
        bills: [],
        message: `All ${billedUnitIds.size} unit(s) already have bills for Q${billingQuarter} ${billingYear}`,
      }, { status: 200 })
    }

    const validUnits = unbilledUnits
      .map((u) => ({ unit: u, tier: findApplicableTier(u.areaSqm, rate.tiers) }))
      .filter((entry): entry is { unit: typeof units[number]; tier: NonNullable<ReturnType<typeof findApplicableTier>> } => entry.tier !== null)
    console.log('[CUSA Bills] validUnits:', validUnits.length, validUnits.map(v => `${v.unit.unitNo} tier=${v.tier.fromArea}-${v.tier.toArea}`))

    if (validUnits.length === 0) {
      const tierInfo = rate.tiers.map((t) => `${t.fromArea}-${t.toArea ?? '∞'} sqm`).join(', ')
      const unitAreas = unbilledUnits.map((u) => `${u.unitNo}: ${u.areaSqm} sqm`).join(', ')
      return NextResponse.json(
        {
          error: 'No units match the rate tiers for billing',
          details: `Rate tiers: [${tierInfo}] | Unit areas: [${unitAreas}]`,
        },
        { status: 400 }
      )
    }

    let currentSequence = await getNextCusaBillSequence(billingYear, billingQuarter)

    const createdBills = await prisma.$transaction(async (tx) => {
      const bills = []
      for (const { unit, tier } of validUnits) {
        const totalAmount = computeCusaAmount(unit.areaSqm, tier.pricePerSqm, months)
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
            billingMonth: startMonth,
            billingMonths: months,
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
