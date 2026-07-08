import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const rate = await prisma.waterRate.findUnique({
      where: { id: params.id },
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    if (!rate) {
      return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
    }

    return NextResponse.json(rate)
  } catch (error) {
    console.error('Error fetching rate:', error)
    return NextResponse.json({ error: 'Failed to fetch rate' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    // Delete existing tiers and recreate
    if (body.tiers) {
      await prisma.waterRateTier.deleteMany({ where: { rateId: params.id } })
    }

    const rate = await prisma.waterRate.update({
      where: { id: params.id },
      data: {
        name: body.name,
        rateType: body.rateType,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : (body.effectiveTo === null ? null : undefined),
        isActive: body.isActive,
        branchId: body.branchId,
        tiers: body.tiers
          ? {
              create: body.tiers.map((tier: { fromUnit: number; toUnit: number | null; pricePerUnit: number; sequence: number }) => ({
                fromUnit: tier.fromUnit,
                toUnit: tier.toUnit ?? null,
                pricePerUnit: tier.pricePerUnit,
                sequence: tier.sequence,
              })),
            }
          : undefined,
      },
      include: { tiers: { orderBy: { sequence: 'asc' } } },
    })

    return NextResponse.json(rate)
  } catch (error) {
    console.error('Error updating rate:', error)
    return NextResponse.json({ error: 'Failed to update rate' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    // Soft delete by deactivating
    await prisma.waterRate.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true, message: 'Rate deactivated' })
  } catch (error) {
    console.error('Error deleting rate:', error)
    return NextResponse.json({ error: 'Failed to delete rate' }, { status: 500 })
  }
}
