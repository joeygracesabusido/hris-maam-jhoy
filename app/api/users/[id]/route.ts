import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('userRole')?.value

    if (!userRole || !['ADMIN', 'HR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin or HR access required' },
        { status: 403 }
      )
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const body = await request.json()
    // Support both { role, status } and { userId, role, status } payloads
    const status = body.status as string | undefined
    const role = body.role as string | undefined

    if (!status && !role) {
      return NextResponse.json(
        { error: 'At least one field (status or role) is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['FOR_APPROVAL', 'APPROVED', 'REJECTED']
    const validRoles = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const updateData: Prisma.UserUpdateInput = {}
    if (status) updateData.status = status
    if (role) updateData.role = role as Prisma.UserUpdateInput['role']
    // Allow updating name/email if provided (optional extensibility)
    if (typeof body.name === 'string') updateData.name = body.name
    if (typeof body.email === 'string') updateData.email = body.email

    try {
      const user = await prisma.user.update({
        where: { id },
        data: updateData,
      })
      return NextResponse.json(user)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('userRole')?.value
    if (userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }
    const { id } = params
    try {
      await prisma.user.delete({ where: { id } })
      return NextResponse.json({ message: 'User deleted successfully' })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
