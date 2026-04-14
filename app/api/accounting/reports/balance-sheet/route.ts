/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      include: { lines: true },
      orderBy: { code: 'asc' },
    });

    const report: any = {
      assets: [],
      liabilities: [],
      equity: [],
      totalAssets: 0,
      totalLiabilitiesEquity: 0,
    };

    accounts.forEach(account => {
      const totalDebit = account.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + line.credit, 0);
      const balance = account.type === 'ASSET'
        ? totalDebit - totalCredit
        : (account.type === 'LIABILITY' || account.type === 'EQUITY')
          ? totalCredit - totalDebit
          : 0;

      if (balance === 0) return;

      if (account.type === 'ASSET') {
        report.assets.push({ name: account.name, code: account.code, balance });
      } else if (account.type === 'LIABILITY') {
        report.liabilities.push({ name: account.name, code: account.code, balance });
      } else if (account.type === 'EQUITY') {
        report.equity.push({ name: account.name, code: account.code, balance });
      }
    });

    report.totalAssets = report.assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = report.liabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEquity = report.equity.reduce((sum, acc) => sum + acc.balance, 0);
    report.totalLiabilitiesEquity = totalLiabilities + totalEquity;

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return NextResponse.json({ error: 'Failed to generate balance sheet' }, { status: 500 });
  }
}
