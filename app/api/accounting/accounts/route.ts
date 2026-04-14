/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { code: 'asc' },
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, type, parentCode, description, normalBalance } = body;

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
