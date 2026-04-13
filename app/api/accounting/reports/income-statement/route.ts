import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: { lines: true },
      orderBy: { code: 'asc' },
    });

    const report = {
      revenue: [],
      expenses: [],
      netIncome: 0,
    };

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);
      const balance = account.type === 'REVENUE' ? totalCredit - totalDebit : totalDebit - totalCredit;

      if (account.type === 'REVENUE' && balance !== 0) {
        report.revenue.push({ name: account.name, code: account.code, balance });
      } else if (account.type === 'EXPENSE' && balance !== 0) {
        report.expenses.push({ name: account.name, code: account.code, balance });
      }
    });

    const totalRevenue = report.revenue.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = report.expenses.reduce((sum, acc) => sum + acc.balance, 0);
    report.netIncome = totalRevenue - totalExpenses;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating income statement:', error);
    return NextResponse.json({ error: 'Failed to generate income statement' }, { status: 500 });
  }
}
