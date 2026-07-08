import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (status) where.status = status
    if (branchId && branchId !== 'all') where.branchId = branchId

    const meters = await prisma.waterMeter.findMany({
      where,
      include: {
        tenant: true,
        _count: { select: { readings: true, bills: true } },
      },
      orderBy: { meterNo: 'asc' },
    })

    return NextResponse.json(meters)
  } catch (error) {
    console.error('Error fetching meters:', error)
    return NextResponse.json({ error: 'Failed to fetch meters' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { meterNo, tenantId, unitNo, location, status, installationDate, branchId } = body

    if (!meterNo) {
      return NextResponse.json({ error: 'Meter number is required' }, { status: 400 })
    }

    const existing = await prisma.waterMeter.findUnique({ where: { meterNo } })
    if (existing) {
      return NextResponse.json({ error: 'Meter number already exists' }, { status: 400 })
    }

    const meter = await prisma.waterMeter.create({
      data: {
        meterNo,
        tenantId: tenantId || null,
        unitNo,
        location,
        status: status || 'ACTIVE',
        installationDate: installationDate ? new Date(installationDate) : null,
        branchId: branchId || null,
      },
    })

    return NextResponse.json(meter, { status: 201 })
  } catch (error) {
    console.error('Error creating meter:', error)
    return NextResponse.json({ error: 'Failed to create meter' }, { status: 500 })
  }
}
