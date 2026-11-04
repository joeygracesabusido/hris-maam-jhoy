import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const resolvedParams = await params;
    const resetRequest = await prisma.passwordResetRequest.findUnique({
      where: { id: resolvedParams.id },
      include: { user: true },
    });

    if (!resetRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (resetRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Request must be approved before generating code' },
        { status: 400 }
      );
    }

    // Generate new code
    const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await prisma.passwordResetRequest.update({
      where: { id: resolvedParams.id },
      data: { resetCode, codeExpiresAt },
      include: { user: true },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error('Generate reset code error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}