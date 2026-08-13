import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';

export const dynamic = 'force-dynamic';

const localPrisma = new PrismaClient();

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  runningBalance: number;
  advanceId: string;
  reference?: string;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    // Determine which employee to query
    let targetEmployeeId = employeeId;

    if (!hasAdminAccess(userRole || '')) {
      // EMPLOYEE role: only their own advances
      targetEmployeeId = (await getEmployeeIdForUser(userEmail, userRole || '')) || null;
      if (!targetEmployeeId) {
        return NextResponse.json({ error: 'Employee not found for user' }, { status: 404 });
      }
    }

    // If targetEmployeeId is 'all' or not provided (for Admin/HR), return all employees' summaries
    if (!targetEmployeeId || targetEmployeeId === 'all') {
      const employees = await localPrisma.employee.findMany({
        select: { id: true, fullName: true, employeeId: true },
        orderBy: { fullName: 'asc' },
      });

      const advances = (await localPrisma.advance.findMany({
        where: { type: 'CASH_ADVANCE' },
        include: {
          payments: {
            where: { payrollId: { not: null } },
          },
        },
      })) as (Awaited<ReturnType<typeof localPrisma.advance.findMany>>[number] & {
        payments: Array<{
          id: string;
          amount: number;
          paymentDate: Date;
          payrollId: string | null;
        }>;
      })[];

      const summaries = employees
        .map((emp) => {
          const empAdvances = advances.filter((a) => a.employeeId === emp.id);
          let totalDebits = 0;
          let totalCredits = 0;

          for (const adv of empAdvances) {
            totalDebits += adv.totalAmount;
            for (const p of adv.payments) {
              totalCredits += p.amount;
            }
          }

          return {
            employee: emp,
            totalDebits,
            totalCredits,
            currentBalance: totalDebits - totalCredits,
            advanceCount: empAdvances.length,
          };
        })
        .filter((s) => s.advanceCount > 0 || s.currentBalance !== 0);

      return NextResponse.json(summaries);
    }

    // Fetch employee info
    const employee = await localPrisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { id: true, fullName: true, employeeId: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Fetch only CASH_ADVANCE records for this employee with payments
    const advances = (await localPrisma.advance.findMany({
      where: {
        employeeId: targetEmployeeId,
        type: 'CASH_ADVANCE',
      },
      include: {
        payments: {
          where: {
            payrollId: { not: null },
          },
          orderBy: { paymentDate: 'asc' },
          include: {
            payroll: {
              select: { periodStart: true, periodEnd: true },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    })) as (Awaited<ReturnType<typeof localPrisma.advance.findMany>>[number] & {
      payments: Array<{
        id: string
        amount: number
        balanceAfter: number
        paymentDate: Date
        notes: string | null
        payroll: { periodStart: Date; periodEnd: Date } | null
      }>
    })[];

    // Transform into ledger entries
    const entries: LedgerEntry[] = [];

    for (const advance of advances) {
      // DEBIT entry: when the advance was given
      const advanceDate = advance.date
        ? new Date(advance.date).toISOString()
        : advance.createdAt.toISOString();

      entries.push({
        id: `${advance.id}-debit`,
        date: advanceDate,
        description: `Cash Advance${advance.reference ? ` - Ref: ${advance.reference}` : ''}`,
        type: 'DEBIT',
        amount: advance.totalAmount,
        runningBalance: 0,
        advanceId: advance.id,
        reference: advance.reference || undefined,
      });

      // CREDIT entries: each payroll deduction
      for (const payment of advance.payments) {
        const periodLabel = payment.payroll
          ? ` (${new Date(payment.payroll.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(payment.payroll.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
          : '';

        entries.push({
          id: payment.id,
          date: new Date(payment.paymentDate).toISOString(),
          description: `Payroll Deduction${periodLabel}`,
          type: 'CREDIT',
          amount: payment.amount,
          runningBalance: 0,
          advanceId: advance.id,
        });
      }
    }

    // Sort by date ascending
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let balance = 0;
    for (const entry of entries) {
      if (entry.type === 'DEBIT') {
        balance += entry.amount;
      } else {
        balance -= entry.amount;
      }
      entry.runningBalance = balance;
    }

    return NextResponse.json({
      employee,
      entries,
      summary: {
        totalDebits: entries
          .filter((e) => e.type === 'DEBIT')
          .reduce((sum, e) => sum + e.amount, 0),
        totalCredits: entries
          .filter((e) => e.type === 'CREDIT')
          .reduce((sum, e) => sum + e.amount, 0),
        currentBalance: balance,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching advance summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch advance summary', details: errorMessage }, { status: 500 });
  }
}
