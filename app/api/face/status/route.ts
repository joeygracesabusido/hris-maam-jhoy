import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRequestSession } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/face/status
 *
 * Returns the face enrollment status for the authenticated employee.
 * Response:
*   Enrolled:  { enrolled: true,  employeeName: string, enrolledAt: string | null }
  *   Not:       { enrolled: false, employeeName: string }
 */
export async function GET(request: NextRequest) {
  try {
    let userEmail: string;
    try {
      const session = await getRequestSession(request);
      userEmail = session.userEmail;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employee = await prisma.employee.findFirst({
      where: { email: userEmail },
      select: {
        fullName: true,
        faceDescriptor: true,
        faceEnrolledAt: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const hasDescriptor =
      employee.faceDescriptor && (employee.faceDescriptor as number[]).length > 0;

    if (hasDescriptor) {
      return NextResponse.json({
        enrolled: true,
        employeeName: employee.fullName ?? '',
        enrolledAt: employee.faceEnrolledAt
          ? new Date(employee.faceEnrolledAt).toISOString()
          : null,
      });
    }

    return NextResponse.json({
      enrolled: false,
      employeeName: employee.fullName ?? '',
    });
  } catch (error) {
    console.error('[Face Status API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
