import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resetCode, newPassword, confirmPassword } = body;

    if (!resetCode || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Reset code, new password, and confirmation are required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain uppercase, lowercase, and numbers' },
        { status: 400 }
      );
    }

    // Find valid reset request
    const resetRequest = await prisma.passwordResetRequest.findFirst({
      where: {
        resetCode: resetCode.toUpperCase(),
        status: 'APPROVED',
        codeExpiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired reset code' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and mark request completed
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRequest.userId },
        data: {
          password: hashedPassword,
          failedAttempts: 0,
          lockUntil: null,
        },
      }),
      prisma.passwordResetRequest.update({
        where: { id: resetRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          resetCode: null,
          codeExpiresAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}