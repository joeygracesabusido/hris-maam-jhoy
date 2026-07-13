import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rate = await prisma.cusaRate.findUnique({
      where: { id: params.id },
      include: {
        tiers: { orderBy: { sequence: 'asc' } },
        _count: { select: { bills: true } },
      },
    })

    if (!rate) {
      return NextResponse.json({ error: 'CUSA rate not found' }, { status: 404 })
    }

    return NextResponse.json(rate)
  } catch (error) {
    console.error('Error fetching CUSA rate:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA rate' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    if (body.effectiveTo !== undefined && body.effectiveTo !== null) {
      const effectiveFrom = body.effectiveFrom
        ? new Date(body.effectiveFrom)
        : (await prisma.cusaRate.findUnique({ where: { id: params.id } }))?.effectiveFrom
      if (effectiveFrom && new Date(body.effectiveTo) < effectiveFrom) {
        return NextResponse.json({ error: 'effectiveTo must be after effectiveFrom' }, { status: 400 })
      }
    }

    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }
    }

    if (body.tiers) {
      if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
        return NextResponse.json({ error: 'tiers must be a non-empty array' }, { status: 400 })
      }

      for (const tier of body.tiers) {
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

      await prisma.$transaction([
        prisma.cusaRateTier.deleteMany({ where: { rateId: params.id } }),
        prisma.cusaRateTier.createMany({
          data: body.tiers.map((tier: { fromArea: number; toArea?: number | null; pricePerSqm: number }, index: number) => ({
            rateId: params.id,
            fromArea: tier.fromArea,
            toArea: tier.toArea ?? null,
            pricePerSqm: tier.pricePerSqm,
            sequence: index + 1,
          })),
        }),
      ])
    }

    const rate = await prisma.cusaRate.update({
      where: { id: params.id },
      data: {
        name: body.name,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo !== undefined ? (body.effectiveTo ? new Date(body.effectiveTo) : null) : undefined,
        isActive: body.isActive,
        branchId: body.branchId !== undefined ? (body.branchId || null) : undefined,
      },
      include: {
        tiers: { orderBy: { sequence: 'asc' } },
      },
    })

    return NextResponse.json(rate)
  } catch (error) {
    console.error('Error updating CUSA rate:', error)
    return NextResponse.json({ error: 'Failed to update CUSA rate' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const billCount = await prisma.cusaBill.count({
      where: { rateId: params.id },
    })

    if (billCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete rate that has been used in bills' },
        { status: 400 }
      )
    }

    await prisma.cusaRate.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting CUSA rate:', error)
    return NextResponse.json({ error: 'Failed to delete CUSA rate' }, { status: 500 })
  }
}
