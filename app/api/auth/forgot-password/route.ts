import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier } = body; // username or email

    if (!identifier) {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 }
      );
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase() },
          { email: identifier.toLowerCase() },
        ],
      },
    });

    // Always return success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If the account exists, a password reset request has been submitted.',
      });
    }

    // Check for recent pending request (rate limiting - 1 hour)
    const recentRequest = await prisma.passwordResetRequest.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
        requestedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour
      },
    });

    if (recentRequest) {
      return NextResponse.json(
        { error: 'A password reset request is already pending. Please wait for admin approval.' },
        { status: 429 }
      );
    }

    // Check for recently completed request (prevent spam)
    const recentCompleted = await prisma.passwordResetRequest.findFirst({
      where: {
        userId: user.id,
        status: 'COMPLETED',
        completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1 hour
      },
    });

    if (recentCompleted) {
      return NextResponse.json(
        { error: 'A password reset was recently completed. Please wait before requesting another.' },
        { status: 429 }
      );
    }

    // Get client IP for audit
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // Create reset request
    await prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        status: 'PENDING',
        requestedBy: ip,
      },
    });

    return NextResponse.json({
      message: 'Password reset request submitted. An administrator will review and provide a reset code.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}