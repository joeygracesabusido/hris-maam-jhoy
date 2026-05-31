import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRequestSession } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let userEmail: string, userRole: string;
    try {
      const session = await getRequestSession(request);
      userEmail = session.userEmail;
      userRole = session.userRole;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the employee by id (Employee.id) OR userId (User.id)
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id },
          { userId: id },
        ],
      },
      select: { id: true, email: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check authorization
    // ADMIN/HR can enroll any employee's face
    // EMPLOYEE can only enroll their own face
    if (userRole === 'EMPLOYEE') {
      // Employees can only enroll their own face
      if (employee.email !== userEmail) {
        return NextResponse.json({ error: 'Forbidden – you can only enroll your own face' }, { status: 403 });
      }
    } else if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Forbidden – only ADMIN or HR can enroll faces' }, { status: 403 });
    }

    const body = await request.json();
    const { faceDescriptor } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return NextResponse.json({ error: 'Invalid face descriptor' }, { status: 400 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        faceDescriptor: faceDescriptor,
      },
    });

    return NextResponse.json({
      message: 'Face descriptor enrolled successfully',
      employeeId: updatedEmployee.id,
    });
  } catch (error) {
    console.error('[FACE_ENROLL_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
