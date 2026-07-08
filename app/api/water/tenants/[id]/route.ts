import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      include: {
        meters: {
          where: { status: 'ACTIVE' },
        },
        bills: {
          orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
          take: 12,
        },
        _count: { select: { meters: true, bills: true } },
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('Error fetching tenant:', error)
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const tenant = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        fullName: body.fullName,
        contactNumber: body.contactNumber,
        email: body.email,
        address: body.address,
        unitNo: body.unitNo,
        status: body.status,
        branchId: body.branchId,
      },
    })

    return NextResponse.json(tenant)
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json({ error: 'Failed to update tenant' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const billCount = await prisma.waterBill.count({
      where: { tenantId: params.id, status: { not: 'PAID' } },
    })

    if (billCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tenant with unpaid bills. Void all bills first.' },
        { status: 400 }
      )
    }

    await prisma.tenant.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tenant:', error)
    return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 })
  }
}
