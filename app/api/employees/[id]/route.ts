import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth-helpers'
import { getEmployeeIdForUser } from '@/lib/user-employee-link'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let userEmail: string, userRole: string
    try {
      const session = await getRequestSession(request)
      userEmail = session.userEmail
      userRole = session.userRole
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Build where clause based on role
    const whereClause: Record<string, unknown> = { id }

    // EMPLOYEE role: only see their own record
    if (userRole === 'EMPLOYEE') {
      const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole).catch(() => null)
      if (linkedEmployeeId) {
        if (linkedEmployeeId !== id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        // Fallback: match by email
        whereClause.email = userEmail
      }
    }

    const employee = await prisma.employee.findFirst({
      where: whereClause,
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let _userRole: string
    try {
      const session = await getRequestSession(request)
      _userRole = session.userRole
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (_userRole !== 'ADMIN' && _userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized. Only admins and HR can update employees.' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()

    const allowedFields = [
      'employeeId', 'fullName', 'email', 'position', 'department', 'basicSalary', 'dailyRate', 'payType',
      'payrollFrequency', 'managerId', 'hireDate', 'tin', 'sssNo', 'philhealthNo',
      'pagibigNo', 'bankName', 'bankAccountNo', 'isActive', 'employeeStatus', 'regularizationDate',
    ]

    const updateData: Record<string, unknown> = {}
    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        if (field === 'basicSalary' || field === 'dailyRate') {
          updateData[field] = parseFloat(String(body[field]))
        } else if (field === 'hireDate' || field === 'regularizationDate') {
          const dateValue = body[field]
          if (dateValue && dateValue !== '') {
            updateData[field] = new Date(dateValue)
          } else {
            updateData[field] = null
          }
        } else {
          updateData[field] = body[field]
        }
      }
    })

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ message: 'Employee updated successfully', employee }, { status: 200 })
  } catch (error: unknown) {
    console.error('Error updating employee:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to update employee', details: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    let _userRole: string
    try {
      const session = await getRequestSession(request)
      _userRole = session.userRole
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (_userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can delete employees.' }, { status: 403 })
    }

    const { id } = params

    // Check if employee exists
    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Handle self-referencing manager constraint (onDelete: NoAction)
    // Set managerId to null on any subordinates before deleting
    await prisma.employee.updateMany({
      where: { managerId: id },
      data: { managerId: null },
    })

    // Delete the employee (cascades to timeLogs, payrolls, leaveRequests,
    // overtimeRequests, advances, leaveCredits, shiftSchedules)
    await prisma.employee.delete({ where: { id } })

    return NextResponse.json({ message: 'Employee deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting employee:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to delete employee', details: errorMessage }, { status: 500 })
  }
}
