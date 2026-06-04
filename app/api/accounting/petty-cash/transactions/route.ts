import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

interface FundTransaction {
  id: string;
  date: string;
  type: 'DISBURSEMENT' | 'LIQUIDATION' | 'REPLENISHMENT';
  description: string;
  payee: string | null;
  amount: number;
  status: string;
}

type ReplenishmentWithLines = Prisma.JournalEntryGetPayload<{
  include: { lines: true };
}>;

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    if (!userRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pettyCashId = searchParams.get('pettyCashId');

    if (!pettyCashId) {
      return NextResponse.json({ error: 'pettyCashId is required' }, { status: 400 });
    }

    const fund = await prisma.pettyCash.findUnique({
      where: { id: pettyCashId },
    });

    if (!fund) {
      return NextResponse.json({ error: 'Fund not found' }, { status: 404 });
    }

    const [disbursements, liquidations] = await Promise.all([
      prisma.pettyCashDisbursement.findMany({
        where: { pettyCashId },
        orderBy: { date: 'asc' },
      }),
      prisma.pettyCashLiquidation.findMany({
        where: { pettyCashId },
        orderBy: { date: 'asc' },
      }),
    ]);

    const transactions: FundTransaction[] = [
      ...disbursements.map(d => ({
        id: d.id,
        date: (d.date || d.createdAt).toISOString(),
        type: 'DISBURSEMENT' as const,
        description: d.description || 'Disbursement',
        payee: d.payeeName,
        amount: d.amount,
        status: d.status,
      })),
      ...liquidations.map(l => ({
        id: l.id,
        date: (l.date || l.createdAt).toISOString(),
        type: 'LIQUIDATION' as const,
        description: l.notes || 'Liquidation',
        payee: null,
        amount: l.amount,
        status: l.status,
      })),
    ];

    // Fetch replenishment journal entries for this fund
    const replenishments = await prisma.journalEntry.findMany({
      where: {
        description: { contains: `Petty Cash Replenishment - ${fund.name}` },
        reference: { startsWith: 'REP-' },
      },
      include: { lines: true },
      orderBy: { date: 'asc' },
    });

    for (const rep of replenishments satisfies ReplenishmentWithLines[]) {
      const creditLine = rep.lines.find((line) => line.credit > 0);
      transactions.push({
        id: `rep-${rep.id}`,
        date: rep.date.toISOString(),
        type: 'REPLENISHMENT',
        description: `Replenishment${rep.reference ? ` (${rep.reference})` : ''}`,
        payee: null,
        amount: creditLine?.credit ?? 0,
        status: rep.status,
      });
    }

    // Sort by date ascending
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = fund.fundAmount;
    const entries = transactions.map(t => {
      if (t.type === 'DISBURSEMENT') {
        runningBalance -= t.amount;
      } else if (t.type === 'LIQUIDATION' || t.type === 'REPLENISHMENT') {
        runningBalance += t.amount;
      }
      return { ...t, runningBalance };
    });

    return NextResponse.json({
      fund: {
        id: fund.id,
        name: fund.name,
        fundAmount: fund.fundAmount,
        currentBalance: fund.currentBalance,
        status: fund.status,
      },
      entries,
    });
  } catch (error) {
    console.error('Error fetching fund transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
