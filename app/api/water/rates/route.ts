import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const branchId = searchParams.get('branchId')

    const where: Record<string, unknown> = {}
    if (isActive) where.isActive = isActive === 'true'
    if (branchId && branchId !== 'all') where.branchId = branchId

    const rates = await prisma.waterRate.findMany({
      where,
      include: {
        tiers: { orderBy: { sequence: 'asc' } },
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    return NextResponse.json(rates)
  } catch (error) {
    console.error('Error fetching rates:', error)
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, rateType, effectiveFrom, effectiveTo, isActive, tiers, branchId } = body

    if (!name || !effectiveFrom) {
      return NextResponse.json({ error: 'Name and effective date are required' }, { status: 400 })
    }

    if (rateType === 'TIERED' && (!tiers || tiers.length === 0)) {
      return NextResponse.json({ error: 'Tiered rates require at least one tier' }, { status: 400 })
    }

    const rate = await prisma.waterRate.create({
      data: {
        name,
        rateType: rateType || 'TIERED',
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: isActive !== undefined ? isActive : true,
        branchId: branchId || null,
        tiers: {
          create: (tiers || []).map((tier: { fromUnit: number; toUnit: number | null; pricePerUnit: number; sequence: number }) => ({
            fromUnit: tier.fromUnit,
            toUnit: tier.toUnit ?? null,
            pricePerUnit: tier.pricePerUnit,
            sequence: tier.sequence,
          })),
        },
      },
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    return NextResponse.json(rate, { status: 201 })
  } catch (error) {
    console.error('Error creating rate:', error)
    return NextResponse.json({ error: 'Failed to create rate' }, { status: 500 })
  }
}
