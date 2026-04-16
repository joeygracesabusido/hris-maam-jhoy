/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function calculateAccountBalance(accountId: string, normalBalance: string) {
  const lines = await prisma.journalLine.findMany({
    where: { accountId },
    select: { debit: true, credit: true },
  });

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  // For debit-normal accounts (Assets, Expenses): Balance = Debits - Credits
  // For credit-normal accounts (Liabilities, Equity, Revenue): Balance = Credits - Debits
  const balance = normalBalance === 'DEBIT' ? totalDebit - totalCredit : totalCredit - totalDebit;
  return Math.round(balance * 100) / 100; // Round to 2 decimals
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single account with balance
      const account = await prisma.account.findUnique({
        where: { id },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const balance = await calculateAccountBalance(account.id, account.normalBalance);
      return NextResponse.json({ ...account, balance });
    }

    // Get all accounts
    const accounts = await prisma.account.findMany({
      orderBy: { code: 'asc' },
    });

    // Calculate balances for all accounts
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => ({
        ...account,
        balance: await calculateAccountBalance(account.id, account.normalBalance),
      }))
    );

    return NextResponse.json(accountsWithBalances);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, type, parentCode, description, normalBalance, hasSubsidiaryLedger, subsidiaryType } = body;

    if (!code || !name || !type) {
      return NextResponse.json({ error: 'Code, name, and type are required' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        type,
        parentCode,
        description,
        normalBalance: normalBalance || 'DEBIT',
        hasSubsidiaryLedger: hasSubsidiaryLedger || false,
        subsidiaryType: hasSubsidiaryLedger && subsidiaryType ? subsidiaryType : undefined,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }
    console.error('Error creating account:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, code, name, type, parentCode, description, isActive, normalBalance, hasSubsidiaryLedger, subsidiaryType } = body;

    if (!id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        code,
        name,
        type,
        parentCode,
        description,
        isActive,
        normalBalance,
        hasSubsidiaryLedger,
        subsidiaryType: hasSubsidiaryLedger && subsidiaryType ? subsidiaryType : undefined,
      },
    });

    const balance = await calculateAccountBalance(account.id, account.normalBalance);
    return NextResponse.json({ ...account, balance });
  } catch (error) {
    if (error instanceof Error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 400 });
    }
    if (error instanceof Error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    console.error('Error updating account:', error);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
