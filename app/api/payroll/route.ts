/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  computePayroll,
  calculateDailyRate,
} from '@/lib/payroll';
import { cache } from '@/lib/redis';
import { cookies } from 'next/headers';
import { hasAdminAccess } from '@/lib/auth-helpers';
import { getEmployeeIdForUser } from '@/lib/user-employee-link';
import { recomputeTimeLogFromSchedule } from '@/lib/late-computation';

const MANILA_TIMEZONE = 'Asia/Manila';

function toManilaDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: MANILA_TIMEZONE });
}

export const dynamic = 'force-dynamic';

const PAYROLL_CACHE_PREFIX = 'payroll:';

function calculateSemiMonthlySalary(monthlySalary: number, frequency: string): number {
  if (frequency === 'SEMIMONTHLY') {
    return monthlySalary / 2;
  }
  return monthlySalary;
}

function countWorkingDays(
  start: Date,
  end: Date,
  holidays: { isActive: boolean; date: Date }[] = []
): number {
  let count = 0;
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const holidayDates = new Set(
    holidays
      .filter((h) => h.isActive)
      .map((h) => new Date(h.date).toISOString().split('T')[0])
  );

  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    const dateStr = cur.toISOString().split('T')[0];
    if (day !== 0 && day !== 6 && !holidayDates.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function processEmployeePayroll(
  employee: any,
  startDate: Date,
  endDate: Date,
  frequency: string,
  deductions: string[],
  adjustmentAdd: number,
  adjustmentDeduct: number,
  adjustmentReason: string,
  holidays: any[]
) {
  const includeSSS = deductions.includes('sss');
  const includePhilHealth = deductions.includes('philhealth');
  const includePagIBIG = deductions.includes('pagibig');
  const includeTax = deductions.includes('tax');

  const selectedAdvanceTypes = [];
  if (deductions.includes('cash_advance')) selectedAdvanceTypes.push('CASH_ADVANCE');
  if (deductions.includes('sss_loan')) selectedAdvanceTypes.push('SSS_LOAN');
  if (deductions.includes('pagibig_loan')) selectedAdvanceTypes.push('PAGIBIG_LOAN');

  const nextDay = new Date(endDate.getTime() + 86400000);

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: startDate, lt: nextDay },
    },
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  const shiftSchedules = await prisma.shiftSchedule.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: startDate, lt: nextDay },
    },
    include: { shift: true },
  });

  // Heal time logs: if a shift schedule exists for a date but the time log's
  // lateMinutes/undertimeMinutes are stale (e.g. the schedule was added
  // retroactively after the clock-in), recompute from the schedule and persist.
  const shiftScheduleByDate = new Map<string, typeof shiftSchedules[number]>();
  for (const s of shiftSchedules) {
    shiftScheduleByDate.set(toManilaDateKey(s.date), s);
  }

  for (const log of timeLogs) {
    if (!log.clockIn && !log.clockOut) continue;
    const schedule = shiftScheduleByDate.get(toManilaDateKey(log.date));
    if (!schedule?.shift) continue;

    const corrected = recomputeTimeLogFromSchedule(log, schedule.shift);
    if (!corrected.hasSchedule) continue;

    const oldLate = log.lateMinutes ?? 0;
    const oldUndertime = log.undertimeMinutes ?? 0;
    if (corrected.lateMinutes === oldLate && corrected.undertimeMinutes === oldUndertime) continue;

    try {
      await prisma.timeLog.update({
        where: { id: log.id },
        data: {
          lateMinutes: corrected.lateMinutes,
          undertimeMinutes: corrected.undertimeMinutes,
        },
      });
    } catch (err) {
      console.error(`[Payroll] Failed to heal time log ${log.id}:`, err);
    }

    log.lateMinutes = corrected.lateMinutes;
    log.undertimeMinutes = corrected.undertimeMinutes;
  }

  const result = computePayroll({
    employee: {
      ...employee,
      payrollDivisor: employee.payrollDivisor || 26
    },
    timeLogs: timeLogs.map(log => ({
      ...log,
      date: new Date(log.date),
      clockIn: log.clockIn ? new Date(log.clockIn) : null,
      clockOut: log.clockOut ? new Date(log.clockOut) : null,
    })),
    leaves: leaves.map(l => ({ daysCount: l.daysCount })),
    shiftSchedules: shiftSchedules.map(s => ({ shift: s.shift })),
    holidays: holidays,
    period: {
      startDate,
      endDate,
      frequency: frequency as any
    },
    deductionsFlags: {
      sss: includeSSS,
      philhealth: includePhilHealth,
      pagibig: includePagIBIG,
      tax: includeTax,
    },
    adjustments: {
      add: adjustmentAdd,
      deduct: adjustmentDeduct,
    }
  });

  const activeAdvances = selectedAdvanceTypes.length > 0 ? await prisma.advance.findMany({
    where: {
      employeeId: employee.id,
      status: 'ACTIVE',
      remainingBalance: { gt: 0 },
      type: { in: selectedAdvanceTypes }
    }
  }) : [];

  let totalAdvanceDeductions = 0;
  const advancePaymentsData = [];

  for (const advance of activeAdvances) {
    const deduction = Math.min(advance.deductionAmount, advance.remainingBalance);
    if (deduction > 0) {
      totalAdvanceDeductions += deduction;
      advancePaymentsData.push({
        advanceId: advance.id,
        amount: deduction,
        balanceAfter: advance.remainingBalance - deduction,
        notes: `Deducted from payroll for ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
    }
  }

  const finalNetPay = result.netPay - totalAdvanceDeductions;
  const finalTotalDeductions = result.totalDeductions + totalAdvanceDeductions;

  const payroll = await prisma.payroll.create({
    data: {
      employee: { connect: { id: employee.id } },
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
      periodStart: startDate,
      periodEnd: endDate,
      basicSalary: result.basicSalary,
      dailyRate: result.dailyRate,
      workDays: result.workDays,
      daysWorked: result.daysWorked,
      otHours: result.otHours,
      otPay: result.otPay,
      holidayPay: result.holidayPay,
      grossPay: result.grossEarnings,
      sssEmployee: result.sssEmployee,
      sssEmployer: result.sssEmployer,
      philhealthEmployee: result.philhealthEmployee,
      philhealthEmployer: result.philhealthEmployer,
      pagibigEmployee: result.pagibigEmployee,
      pagibigEmployer: result.pagibigEmployer,
      withholdingTax: result.withholdingTax,
      lateMinutes: result.lateMinutes,
      undertimeMinutes: result.undertimeMinutes,
      lateDeduction: result.lateDeduction,
      undertimeDeduction: result.undertimeDeduction,
      otherDeductions: result.attendanceDeductions + totalAdvanceDeductions,
      adjustmentAdd,
      adjustmentDeduct,
      adjustmentReason,
      totalDeductions: finalTotalDeductions,
      netPay: finalNetPay,
      status: 'PROCESSED',
      processedAt: new Date(),
    },
  });

  for (const paymentData of advancePaymentsData) {
    await prisma.advancePayment.create({
      data: {
        ...paymentData,
        payrollId: payroll.id,
        paymentDate: new Date()
      }
    });
    await prisma.advance.update({
      where: { id: paymentData.advanceId },
      data: {
        remainingBalance: paymentData.balanceAfter,
        status: paymentData.balanceAfter <= 0 ? 'FULLY_PAID' : 'ACTIVE'
      }
    });
  }

  return { payroll, result };
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;

    if (userRole !== 'ADMIN' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employeeId,
      periodStart,
      periodEnd,
      frequency,
      deductions = ['sss', 'philhealth', 'pagibig', 'tax', 'cash_advance', 'sss_loan', 'pagibig_loan'],
      adjustmentAdd = 0,
      adjustmentDeduct = 0,
      adjustmentReason = ''
    } = body;

    if (!periodStart || !periodEnd || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [startYear, startMonth, startDay] = periodStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = periodEnd.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
    const endDate = new Date(endYear, endMonth - 1, endDay, 0, 0, 0);
    const nextDay = new Date(endDate.getTime() + 86400000);

    const holidays = await prisma.holiday.findMany({
      where: { isActive: true, branchId: null, date: { gte: startDate, lt: nextDay } },
    });

    if (employeeId === 'all') {
      const employees = await prisma.employee.findMany();
      const results = [];
      const errors = [];

      for (const employee of employees) {
        try {
          const existingPayroll = await prisma.payroll.findFirst({
            where: { employeeId: employee.id, periodStart: { gte: startDate }, periodEnd: { lte: endDate } },
          });
          if (existingPayroll) {
            errors.push({ employee: employee.fullName, error: 'Payroll already exists' });
            continue;
          }
          const { payroll, result } = await processEmployeePayroll(employee, startDate, endDate, frequency, deductions, adjustmentAdd, adjustmentDeduct, adjustmentReason, holidays);
          results.push({
            payroll,
            employee: {
              id: employee.id,
              fullName: employee.fullName,
              employeeNumber: employee.employeeNumber,
              position: employee.position,
              department: employee.department,
              payType: employee.payType,
              dailyRate: result.dailyRate
            },
            netPay: result.netPay
          });
        } catch (err: any) {
          errors.push({ employee: employee.fullName, error: err.message });
        }
      }
      return NextResponse.json({ message: 'Computed', successCount: results.length, errorCount: errors.length, results, errors: errors.length > 0 ? errors : undefined });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existingPayroll = await prisma.payroll.findFirst({
      where: { employeeId, periodStart: { gte: startDate }, periodEnd: { lte: endDate } },
    });
    if (existingPayroll) return NextResponse.json({ error: 'Exists' }, { status: 409 });

    const { payroll, result } = await processEmployeePayroll(employee, startDate, endDate, frequency, deductions, adjustmentAdd, adjustmentDeduct, adjustmentReason, holidays);

    return NextResponse.json({
      message: 'Computed',
      payroll,
      details: {
        employee,
        period: { startDate, endDate, frequency },
        earnings: { baseSalary: result.basicSalary, overtimePay: result.otPay, holidayPay: result.holidayPay, grossPay: result.grossEarnings },
        deductions: { absences: result.absenceDeduction, lates: result.lateDeduction, undertime: result.undertimeDeduction, sss: result.sssEmployee, philHealth: result.philhealthEmployee, pagIbig: result.pagibigEmployee, withholdingTax: result.withholdingTax },
        totals: { netPay: result.netPay }
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const linkedEmployeeId = await getEmployeeIdForUser(userEmail, userRole || '');
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const cacheKey = `${PAYROLL_CACHE_PREFIX}${linkedEmployeeId || 'all'}:${employeeId || 'all'}:${month || 'all'}:${year || 'all'}`;
    try {
      const cachedPayrolls = await cache.get(cacheKey);
      if (cachedPayrolls) return NextResponse.json(cachedPayrolls);
    } catch (e) {}

    const where: any = {};
    if (!hasAdminAccess(userRole || '') && linkedEmployeeId) {
      where.employeeId = linkedEmployeeId;
    } else if (employeeId) {
      where.employeeId = employeeId;
    } else if (!hasAdminAccess(userRole || '')) {
      where.employeeId = '000000000000000000000000';
    }

    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const employeeIds = [...new Set(payrolls.map(p => p.employeeId))];
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const validPayrolls = payrolls.map(p => ({
      ...p,
      dailyRate: p.dailyRate ?? 0,
      employee: employeeMap.get(p.employeeId),
    }));

    try {
      await cache.set(cacheKey, validPayrolls, 1800);
    } catch (e) {}

    return NextResponse.json(validPayrolls);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const userRole = cookieStore.get('userRole')?.value;
    if (userRole !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('id');
    if (!payrollId) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
    if (!payroll) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const advancePayments = await prisma.advancePayment.findMany({ where: { payrollId } });
    for (const payment of advancePayments) {
      await prisma.advance.update({
        where: { id: payment.advanceId },
        data: { remainingBalance: { increment: payment.amount }, status: 'ACTIVE' },
      });
    }

    await prisma.advancePayment.deleteMany({ where: { payrollId } });
    await prisma.payroll.delete({ where: { id: payrollId } });

    try {
      await cache.delByPattern(`${PAYROLL_CACHE_PREFIX}*`);
      await cache.delByPattern('advances:*');
    } catch (e) {}

    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
