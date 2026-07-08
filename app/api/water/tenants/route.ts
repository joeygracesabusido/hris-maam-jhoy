import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const branchId = searchParams.get('branchId')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (branchId && branchId !== 'all') where.branchId = branchId

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { unitNo: { contains: search, mode: 'insensitive' as const } },
        { contactNumber: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const tenants = await prisma.tenant.findMany({
      where,
      include: {
        _count: { select: { meters: true, bills: true } },
      },
      orderBy: { fullName: 'asc' },
    })

    return NextResponse.json(tenants)
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fullName, contactNumber, email, address, unitNo, status, branchId } = body

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const tenant = await prisma.tenant.create({
      data: {
        fullName,
        contactNumber,
        email,
        address,
        unitNo,
        status: status || 'ACTIVE',
        branchId: branchId || null,
      },
    })

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    console.error('Error creating tenant:', error)
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
  }
}
