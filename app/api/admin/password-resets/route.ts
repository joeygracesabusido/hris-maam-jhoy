import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verify admin access
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    
    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where = status !== 'ALL' ? { status } : {};

    const [requests, total] = await Promise.all([
      prisma.passwordResetRequest.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true, name: true, role: true },
          },
          reviewer: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.passwordResetRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get password resets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}