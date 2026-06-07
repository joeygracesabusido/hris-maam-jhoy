import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRequestSession } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/face/verify
 *
 * Accepts a face descriptor (128-dim Float32Array) and compares it against
 * ALL registered face descriptors in the employees collection.
 *
 * Returns:
 *   { matched: true,  employee: { id, firstName, lastName, email }, distance: number }
 *   { matched: false }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    let userEmail: string;
    try {
      const session = await getRequestSession(request);
      userEmail = session.userEmail;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { faceDescriptor } = body;

    // Validate face descriptor
    if (
      !faceDescriptor ||
      !Array.isArray(faceDescriptor) ||
      faceDescriptor.length !== 128
    ) {
      return NextResponse.json(
        { error: 'Invalid face descriptor — must be an array of 128 floats' },
        { status: 400 }
      );
    }

    // Fetch all employees that have a registered face descriptor
    const employees = await prisma.employee.findMany({
      where: {
        faceDescriptor: { isEmpty: false },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        faceDescriptor: true,
      },
    });

    // Compare against each stored descriptor using Euclidean distance
    let bestMatch: {
      employee: { id: string; fullName: string; email: string };
      distance: number;
    } | null = null;

    const threshold = 0.6; // Euclidean distance threshold (same as on-device)

    for (const employee of employees) {
      const stored = employee.faceDescriptor as number[];
      if (!stored || stored.length === 0) continue;

      const len = Math.min(faceDescriptor.length, stored.length);
      let sumSquared = 0;
      for (let i = 0; i < len; i++) {
        const diff = faceDescriptor[i] - stored[i];
        sumSquared += diff * diff;
      }
      const distance = Math.sqrt(sumSquared);

      if (distance < threshold && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = {
          employee: {
            id: employee.id,
            fullName: employee.fullName ?? '',
            email: employee.email ?? '',
          },
          distance,
        };
      }
    }

    if (bestMatch) {
      return NextResponse.json({
        matched: true,
        employee: bestMatch.employee,
        distance: bestMatch.distance,
      });
    }

    return NextResponse.json({ matched: false });
  } catch (error) {
    console.error('Face verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
