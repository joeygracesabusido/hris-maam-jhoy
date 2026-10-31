'use strict';

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function getUserRole() {
  const cookieStore = await cookies();
  return cookieStore.get('userRole')?.value || '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const pettyCashId = searchParams.get('pettyCashId');
    const status = searchParams.get('status');
    const branchId = searchParams.get('branchId');

    const where: Record<string, unknown> = {};
    if (id) where.id = id;
    if (pettyCashId) where.pettyCashId = pettyCashId;
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const disbursements = await prisma.pettyCashDisbursement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(disbursements);
  } catch (error) {
    console.error('Error fetching disbursements:', error);
    return NextResponse.json({ error: 'Failed to fetch disbursements' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pettyCashId, amount, description, payeeName, reference, expenseAccountId, date, branchId } = body;

    if (!pettyCashId || !amount) {
      return NextResponse.json(
        { error: 'Petty cash fund and amount are required' },
        { status: 400 }
      );
    }

    const pettyCash = await prisma.pettyCash.findUnique({
      where: { id: pettyCashId },
    });

    if (!pettyCash || pettyCash.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Petty cash fund not found or inactive' },
        { status: 400 }
      );
    }

    if (amount > pettyCash.currentBalance) {
      return NextResponse.json(
        { error: 'Insufficient petty cash balance' },
        { status: 400 }
      );
    }

    const userEmail = await getUserEmail();
    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    const userEmployee = await prisma.employee.findFirst({
      where: { email: userEmail },
      select: { id: true },
    });

    const disbursement = await prisma.pettyCashDisbursement.create({
      data: {
        pettyCashId,
        amount,
        date: date ? new Date(date) : new Date(),
        description,
        payeeName: payeeName || userEmail,
        reference,
        expenseAccountId: expenseAccountId || pettyCash.expenseAccountId,
        status: 'PENDING',
        createdById: user?.id,
        employeeId: userEmployee?.id,
        // Inherit the fund's branch when the caller doesn't specify one, so the
        // disbursement is not hidden by branch filtering on the UI.
        branchId: branchId || pettyCash.branchId || undefined,
      },
    });

    await prisma.pettyCash.update({
      where: { id: pettyCashId },
      data: {
        currentBalance: { decrement: amount },
      },
    });

    return NextResponse.json(disbursement);
  } catch (error) {
    console.error('Error creating disbursement:', error);
    return NextResponse.json({ error: 'Failed to create disbursement' }, { status: 500 });
  }
}

async function getUserEmail() {
  const cookieStore = await cookies();
  return cookieStore.get('userEmail')?.value || '';
}

export async function DELETE(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const disbursement = await prisma.pettyCashDisbursement.findUnique({
      where: { id },
    });
    if (!disbursement) {
      return NextResponse.json({ error: 'Disbursement not found' }, { status: 404 });
    }
    if (disbursement.status === 'LIQUIDATING' || disbursement.status === 'LIQUIDATED') {
      return NextResponse.json(
        { error: 'Cannot delete a disbursement that is being liquidated' },
        { status: 400 }
      );
    }

    const liquidationCount = await prisma.pettyCashLiquidation.count({
      where: { disbursementId: id },
    });
    if (liquidationCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete: this disbursement has liquidations' },
        { status: 400 }
      );
    }

    // Refund the fund balance; creation decremented it, and rejection already refunded it
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (disbursement.status !== 'REJECTED') {
      operations.push(
        prisma.pettyCash.update({
          where: { id: disbursement.pettyCashId },
          data: { currentBalance: { increment: disbursement.amount } },
        })
      );
    }
    operations.push(prisma.pettyCashDisbursement.delete({ where: { id } }));
    await prisma.$transaction(operations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting disbursement:', error);
    return NextResponse.json({ error: 'Failed to delete disbursement' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userRole = await getUserRole();
    if (userRole !== 'ADMIN' && userRole !== 'HR' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status: newStatus, notes, branchId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const disbursement = await prisma.pettyCashDisbursement.findUnique({
      where: { id },
    });

    if (!disbursement) {
      return NextResponse.json(
        { error: 'Disbursement not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      approvedBy: newStatus === 'APPROVED' ? userRole : null,
      approvedAt: newStatus === 'APPROVED' ? new Date() : null,
    };
    if (branchId !== undefined) updateData.branchId = branchId;

    const updated = await prisma.pettyCashDisbursement.update({
      where: { id },
      data: updateData,
    });

    if (newStatus === 'REJECTED') {
      await prisma.pettyCash.update({
        where: { id: disbursement.pettyCashId },
        data: {
          currentBalance: { increment: disbursement.amount },
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating disbursement:', error);
    return NextResponse.json({ error: 'Failed to update disbursement' }, { status: 500 });
  }
}