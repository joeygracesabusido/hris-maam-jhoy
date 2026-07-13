import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const unit = await prisma.cusaUnit.findUnique({
      where: { id: params.id },
      include: {
        tenant: true,
        bills: {
          orderBy: [{ billingYear: 'desc' }, { billingQuarter: 'desc' }],
          take: 12,
        },
        _count: { select: { bills: true } },
      },
    })

    if (!unit) {
      return NextResponse.json({ error: 'CUSA unit not found' }, { status: 404 })
    }

    return NextResponse.json(unit)
  } catch (error) {
    console.error('Error fetching CUSA unit:', error)
    return NextResponse.json({ error: 'Failed to fetch CUSA unit' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    // Validate input ranges if provided
    if (body.floor !== undefined && body.floor < 0) {
      return NextResponse.json({ error: 'Floor must be non-negative' }, { status: 400 })
    }
    if (body.areaSqm !== undefined && body.areaSqm <= 0) {
      return NextResponse.json({ error: 'Area must be positive' }, { status: 400 })
    }

    // Validate status if provided
    const validStatuses = ['OCCUPIED', 'VACANT', 'UNDER_RENOVATION']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
    }

    // Validate tenant exists if provided
    if (body.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: body.tenantId } })
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
      }
    }

    // Validate branch exists if provided
    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId } })
      if (!branch) {
        return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
      }
    }

    const unit = await prisma.cusaUnit.update({
      where: { id: params.id },
      data: {
        tenantId: body.tenantId,
        unitNo: body.unitNo,
        floor: body.floor,
        zone: body.zone,
        areaSqm: body.areaSqm,
        status: body.status,
        leaseStart: body.leaseStart ? new Date(body.leaseStart) : undefined,
        leaseEnd: body.leaseEnd ? new Date(body.leaseEnd) : undefined,
        branchId: body.branchId,
      },
      include: {
        tenant: true,
      },
    })

    return NextResponse.json(unit)
  } catch (error) {
    console.error('Error updating CUSA unit:', error)
    return NextResponse.json({ error: 'Failed to update CUSA unit' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const billCount = await prisma.cusaBill.count({
      where: { unitId: params.id, status: { not: 'PAID' } },
    })

    if (billCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete unit with unpaid bills. Void all bills first.' },
        { status: 400 }
      )
    }

    await prisma.cusaUnit.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting CUSA unit:', error)
    return NextResponse.json({ error: 'Failed to delete CUSA unit' }, { status: 500 })
  }
}