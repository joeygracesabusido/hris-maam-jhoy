import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employee = await prisma.employee.findFirst({
    where: { fullName: { contains: 'JEROME R. SABUSIDO' } },
  });

  if (!employee) {
    console.log('Employee not found');
    return;
  }

  console.log('Employee:', employee.fullName, 'ID:', employee.id);

  const startDate = new Date(2026, 4, 1); // May 1
  const endDate = new Date(2026, 4, 15, 23, 59, 59);

  const timeLogs = await prisma.timeLog.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });

  const shiftSchedules = await prisma.shiftSchedule.findMany({
    where: {
      employeeId: employee.id,
      date: { gte: startDate, lte: endDate },
    },
    include: { shift: true },
    orderBy: { date: 'asc' },
  });

  const holidays = await prisma.holiday.findMany({
    where: {
      isActive: true,
      date: { gte: startDate, lte: endDate },
    },
  });

  console.log('\n--- Time Logs ---');
  console.table(timeLogs.map(l => ({
    date: l.date.toISOString().split('T')[0],
    workHours: l.workHours,
    late: l.lateMinutes,
    undertime: l.undertimeMinutes,
    clockIn: l.clockIn?.toISOString(),
    clockOut: l.clockOut?.toISOString(),
  })));

  console.log('\n--- Shift Schedules ---');
  console.table(shiftSchedules.map(s => ({
    date: s.date.toISOString().split('T')[0],
    shiftName: s.shift.name,
    isOff: s.shift.isOff,
  })));

  console.log('\n--- Holidays ---');
  console.table(holidays.map(h => ({
    date: h.date.toISOString().split('T')[0],
    name: h.name,
    type: h.type,
  })));
}

main().catch(console.error);
