import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Return the current time in Manila timezone as a Date object.
 * The returned Date's getTime() = actual UTC + 8h, so:
 *   - getUTCHours() gives Manila hours
 *   - getUTCDate()  gives Manila day-of-month
 */
function getManilaNow(): Date {
  return new Date(Date.now() + MANILA_OFFSET_MS);
}

/**
 * Return the start/end of today's Manila day as fake-UTC timestamps.
 * Since stored dates use getManilaNow() (Date.now() + 8h), the query range
 * must also be in the same fake-UTC space to match correctly.
 */
function getManilaTodayFakeUTC(): { start: Date; end: Date } {
  const now = getManilaNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  // Use the same fake-UTC convention as getManilaNow() — no subtraction
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

/**
 * GET /api/time-logs/today?employeeId=xxx
 *
 * Returns today's time log for the given employee, or null if none exists.
 * Used by the clock-in/out UI to reliably determine the current clock status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const { start: todayStart, end: todayEnd } = getManilaTodayFakeUTC();

    const todayLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
      orderBy: { date: 'desc' },
    });

    if (!todayLog) {
      return NextResponse.json({ todayLog: null });
    }

    // Include employee info for consistency with the main time-logs endpoint
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullName: true, employeeId: true },
    });

    return NextResponse.json({
      todayLog: {
        ...todayLog,
        employee: employee
          ? { fullName: employee.fullName, employeeId: employee.employeeId }
          : { fullName: 'Unknown', employeeId: 'N/A' },
      },
    });
  } catch (error) {
    console.error('Error fetching today time log:', error);
    return NextResponse.json({ error: 'Failed to fetch today time log' }, { status: 500 });
  }
}
