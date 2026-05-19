import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkJeromeMay12() {
  const employees = await prisma.employee.findMany({
    where: {
      fullName: {
        contains: 'Jerome',
        mode: 'insensitive'
      }
    }
  });
  console.log('Found employees:', employees.map(e => ({ id: e.id, name: e.fullName, payType: e.payType, basicSalary: e.basicSalary, dailyRate: e.dailyRate })));

  if (employees.length === 0) {
    console.log('No Jerome found');
    return;
  }

  const jerome = employees[0];
  
  // May 1-15, 2026 in local timezone
  const startDate = new Date(2026, 4, 1, 0, 0, 0, 0);
  const endDate = new Date(2026, 4, 15, 23, 59, 59, 999);
  
  console.log('\n=== Time Logs for May 1-15, 2026 ===');
  console.log('Query range:', startDate.toISOString(), 'to', endDate.toISOString());
  
  const logs = await prisma.timeLog.findMany({
    where: {
      employeeId: jerome.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { date: 'asc' }
  });
  
  console.log(`Found ${logs.length} time logs`);
  
  let totalLate = 0;
  let totalUndertime = 0;
  
  for (const log of logs) {
    const dateStr = new Date(log.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    const late = log.lateMinutes || 0;
    const ut = log.undertimeMinutes || 0;
    totalLate += late;
    totalUndertime += ut;
    
    console.log(`  ${dateStr}: clockIn=${log.clockIn}, clockOut=${log.clockOut}, late=${late}min, undertime=${ut}min, workHours=${log.workHours}`);
  }
  
  console.log(`\nTotal late minutes: ${totalLate}`);
  console.log(`Total undertime minutes: ${totalUndertime}`);
  
  // Check if there's a shift schedule for May 12
  console.log('\n=== Shift Schedules for May 1-15, 2026 ===');
  const schedules = await prisma.shiftSchedule.findMany({
    where: {
      employeeId: jerome.id,
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    include: { shift: true },
    orderBy: { date: 'asc' }
  });
  
  for (const s of schedules) {
    const dateStr = new Date(s.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    console.log(`  ${dateStr}: shift=${s.shift.name}, start=${s.shift.startTime}, end=${s.shift.endTime}, grace=${s.shift.gracePeriodMinutes}min, isOff=${s.shift.isOff}`);
  }
  
  // Check existing payroll
  console.log('\n=== Existing Payroll Records ===');
  const payrolls = await prisma.payroll.findMany({
    where: {
      employeeId: jerome.id,
      month: 5,
      year: 2026
    },
    orderBy: { createdAt: 'desc' }
  });
  
  for (const p of payrolls) {
    console.log(`  Period: ${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`);
    console.log(`    lateMinutes=${p.lateMinutes}, undertimeMinutes=${p.undertimeMinutes}`);
    console.log(`    grossPay=${p.grossPay}, netPay=${p.netPay}, otherDeductions=${p.otherDeductions}`);
  }
}

checkJeromeMay12().then(() => prisma.$disconnect()).catch(err => {
  console.error(err);
  prisma.$disconnect();
});
