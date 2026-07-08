import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const meter = await prisma.waterMeter.findUnique({
      where: { id: params.id },
      include: {
        tenant: true,
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 24,
        },
        bills: {
          orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
          take: 12,
        },
      },
    })

    if (!meter) {
      return NextResponse.json({ error: 'Meter not found' }, { status: 404 })
    }

    return NextResponse.json(meter)
  } catch (error) {
    console.error('Error fetching meter:', error)
    return NextResponse.json({ error: 'Failed to fetch meter' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    if (body.meterNo) {
      const existing = await prisma.waterMeter.findFirst({
        where: { meterNo: body.meterNo, id: { not: params.id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Meter number already exists' }, { status: 400 })
      }
    }

    const meter = await prisma.waterMeter.update({
      where: { id: params.id },
      data: {
        meterNo: body.meterNo,
        tenantId: body.tenantId ?? undefined,
        unitNo: body.unitNo,
        location: body.location,
        status: body.status,
        installationDate: body.installationDate ? new Date(body.installationDate) : undefined,
        branchId: body.branchId,
      },
    })

    return NextResponse.json(meter)
  } catch (error) {
    console.error('Error updating meter:', error)
    return NextResponse.json({ error: 'Failed to update meter' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const readingCount = await prisma.waterMeterReading.count({
      where: { meterId: params.id },
    })

    if (readingCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete meter with existing readings. Deactivate it instead.' },
        { status: 400 }
      )
    }

    await prisma.waterMeter.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meter:', error)
    return NextResponse.json({ error: 'Failed to delete meter' }, { status: 500 })
  }
}
