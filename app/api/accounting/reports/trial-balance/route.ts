import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: {
        lines: true,
      },
      orderBy: { code: 'asc' },
    });

    const trialBalance = accounts.map(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);

      // Calculate balance based on normal balance of the account type
      // Asset/Expense = Debit is increase, Credit is decrease
      // Liability/Equity/Revenue = Credit is increase, Debit is decrease
      const balance = account.type === 'ASSET' || account.type === 'EXPENSE'
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

      return {
        code: account.code,
        name: account.name,
        type: account.type,
        totalDebit,
        totalCredit,
        balance,
        normalBalance: account.normalBalance
      };
    });

    const grandTotalDebit = trialBalance.reduce((sum, acc) => sum + acc.totalDebit, 0);
    const grandTotalCredit = trialBalance.reduce((sum, acc) => sum + acc.totalCredit, 0);

    return NextResponse.json({
      data: trialBalance,
      grandTotalDebit,
      grandTotalCredit,
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01
    });
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json({ error: 'Failed to generate trial balance' }, { status: 500 });
  }
}
