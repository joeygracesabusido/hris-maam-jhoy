import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'
import { z } from 'zod'
import type { HolidayType } from '@prisma/client'

const updateHolidaySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['REGULAR', 'SPECIAL', 'SPECIAL_NON_WORK']).optional(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

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

    const body = await request.json()
    const result = updateHolidaySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, type, branchId, isActive } = result.data
    const updateData: {
      name?: string
      type?: HolidayType
      branchId?: string | null
      isActive?: boolean
    } = {}

    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type as HolidayType
    if (branchId !== undefined) updateData.branchId = branchId
    if (isActive !== undefined) updateData.isActive = isActive

    const holiday = await prisma.holiday.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    await prisma.holiday.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Holiday deleted successfully' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    )
  }
}
