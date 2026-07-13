import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const floor = searchParams.get('floor')
    const branchId = searchParams.get('branchId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (floor) where.floor = parseInt(floor)
    if (branchId && branchId !== 'all') where.branchId = branchId

    if (search) {
      where.OR = [
        { unitNo: { contains: search, mode: 'insensitive' as const } },
        { tenant: { fullName: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    const units = await prisma.cusaUnit.findMany({
      where,
      include: {
        tenant: true,
        _count: { select: { bills: true } },
      },
      orderBy: [{ floor: 'asc' }, { unitNo: 'asc' }],
    })

    return NextResponse.json(units)
  } catch (error) {
    console.error('Error fetching CUSA units:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA units' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, unitNo, floor, zone, areaSqm, status, leaseStart, leaseEnd, branchId } = body

    if (!tenantId || !unitNo || floor === undefined || !areaSqm) {
      return NextResponse.json(
        { error: 'tenantId, unitNo, floor, and areaSqm are required' },
        { status: 400 }
      )
    }

    // Validate tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Validate input ranges
    if (floor < 0) {
      return NextResponse.json({ error: 'Floor must be non-negative' }, { status: 400 })
    }
    if (areaSqm <= 0) {
      return NextResponse.json({ error: 'Area must be positive' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['OCCUPIED', 'VACANT', 'UNDER_RENOVATION']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    // Validate branch exists if provided
    if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }
    }

    const unit = await prisma.cusaUnit.create({
      data: {
        tenantId,
        unitNo,
        floor,
        zone,
        areaSqm,
        status: status || 'OCCUPIED',
        leaseStart: leaseStart ? new Date(leaseStart) : null,
        leaseEnd: leaseEnd ? new Date(leaseEnd) : null,
        branchId: branchId || null,
      },
      include: {
        tenant: true,
      },
    })

    return NextResponse.json(unit, { status: 201 })
  } catch (error) {
    console.error('Error creating CUSA unit:', error)
    return NextResponse.json({ error: 'Failed to create CUSA unit' }, { status: 500 })
  }
}