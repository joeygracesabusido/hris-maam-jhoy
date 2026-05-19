import prisma from './lib/prisma';

async function main() {
  const emp = await prisma.employee.findFirst({ where: { fullName: { contains: 'Jerome', mode: 'insensitive' } } });
  console.log('Employee:', emp?.id, emp?.fullName, emp?.payType, emp?.dailyRate, emp?.basicSalary);
  
  if (!emp) {
    console.log('Employee not found');
    await prisma.$disconnect();
    return;
  }

  const payroll = await prisma.payroll.findFirst({ where: { employeeId: emp.id, month: 5, year: 2026 } });
  console.log('Payroll:', JSON.stringify(payroll, null, 2));

  const start = new Date(2026, 4, 1);
  const end = new Date(2026, 4, 15, 23, 59, 59);
  const logs = await prisma.timeLog.findMany({ where: { employeeId: emp.id, date: { gte: start, lte: end } }, orderBy: { date: 'asc' } });
  console.log('\nTime Logs May 1-15:');
  for (const log of logs) {
    console.log(new Date(log.date).toLocaleDateString('en-CA'), 'late:', log.lateMinutes, 'ut:', log.undertimeMinutes);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
