import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const branchId = searchParams.get('branchId')

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true
    if (branchId && branchId !== 'all') where.branchId = branchId

    const rates = await prisma.cusaRate.findMany({
      where,
      include: {
        tiers: { orderBy: { sequence: 'asc' } },
        _count: { select: { bills: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    })

    return NextResponse.json(rates)
  } catch (error) {
    console.error('Error fetching CUSA rates:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA rates' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, effectiveFrom, effectiveTo, isActive, branchId, tiers } = body

    if (!name || !effectiveFrom || !tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json(
        { error: 'name, effectiveFrom, and tiers (non-empty array) are required' },
        { status: 400 }
      )
    }

    for (const tier of tiers) {
      if (tier.fromArea === undefined || tier.pricePerSqm === undefined) {
        return NextResponse.json(
          { error: 'Each tier must have fromArea and pricePerSqm' },
          { status: 400 }
        )
      }
      if (tier.fromArea < 0) {
        return NextResponse.json({ error: 'fromArea must be non-negative' }, { status: 400 })
      }
      if (tier.pricePerSqm < 0) {
        return NextResponse.json({ error: 'pricePerSqm must be non-negative' }, { status: 400 })
      }
      if (tier.toArea !== undefined && tier.toArea !== null && tier.toArea < tier.fromArea) {
        return NextResponse.json({ error: 'toArea must be greater than or equal to fromArea' }, { status: 400 })
      }
    }

    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }
    }

    const rate = await prisma.cusaRate.create({
      data: {
        name,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: isActive !== false,
        branchId: branchId || null,
        tiers: {
          create: tiers.map((tier: { fromArea: number; toArea?: number | null; pricePerSqm: number }, index: number) => ({
            fromArea: tier.fromArea,
            toArea: tier.toArea ?? null,
            pricePerSqm: tier.pricePerSqm,
            sequence: index + 1,
          })),
        },
      },
      include: {
        tiers: { orderBy: { sequence: 'asc' } },
      },
    })

    return NextResponse.json(rate, { status: 201 })
  } catch (error) {
    console.error('Error creating CUSA rate:', error)
    return NextResponse.json({ error: 'Failed to create CUSA rate' }, { status: 500 })
  }
}
