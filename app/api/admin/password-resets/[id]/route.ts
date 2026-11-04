import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userId = cookieStore.get('userId')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action, notes } = body; // action: 'APPROVE' | 'DENY'

    if (!['APPROVE', 'DENY'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const resolvedParams = await params;
    const resetRequest = await prisma.passwordResetRequest.findUnique({
      where: { id: resolvedParams.id },
      include: { user: true },
    });

    if (!resetRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (resetRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    const updateData: any = {
      status: action === 'APPROVE' ? 'APPROVED' : 'DENIED',
      reviewedAt: new Date(),
      reviewedBy: userId,
      reviewNotes: notes,
    };

    if (action === 'APPROVE') {
      // Generate 6-character alphanumeric reset code
      const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      updateData.resetCode = resetCode;
      updateData.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    const updated = await prisma.passwordResetRequest.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: { user: true },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('Admin password reset action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}