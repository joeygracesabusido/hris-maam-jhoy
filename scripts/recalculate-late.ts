import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';
import { computeLateMinutes, computeUndertimeMinutes, parseTimeString } from '@/lib/late-computation';

const MANILA_TIMEZONE = 'Asia/Manila';

function toManilaDate(utcDate: Date): Date {
  const manilaStr = utcDate.toLocaleString('en-US', { timeZone: MANILA_TIMEZONE });
  return new Date(manilaStr);
}

const args = process.argv.slice(2);
const isApply = args.includes('--apply');

async function main() {
  console.log('=== Late & Undertime Recalculation ===');
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY RUN'}\n`);

  const timeLogs = await prisma.timeLog.findMany({
    where: { clockIn: { not: null } },
    orderBy: { date: 'asc' },
  });

  console.log(`Checking ${timeLogs.length} time logs...\n`);

  const changes: Array<{
    logId: string;
    employeeName: string;
    date: string;
    oldLate: number;
    newLate: number;
    oldUndertime: number;
    newUndertime: number;
  }> = [];

  for (let i = 0; i < timeLogs.length; i++) {
    const log = timeLogs[i];

    if (i > 0 && i % 100 === 0) {
      console.log(`  Progress: ${i}/${timeLogs.length}...`);
    }

    const schedule = await prisma.shiftSchedule.findFirst({
      where: {
        employeeId: log.employeeId,
        date: {
          gte: startOfDay(new Date(log.date)),
          lte: endOfDay(new Date(log.date)),
        },
      },
      include: { shift: true },
    });

    if (!schedule || schedule.shift.isOff) continue;
    if (schedule.shift.startTime === '-' || schedule.shift.endTime === '-') continue;

    const startParts = parseTimeString(schedule.shift.startTime);
    const endParts = parseTimeString(schedule.shift.endTime);
    if (!startParts || !endParts) continue;

    const [startHour, startMinute] = startParts;
    const [endHour, endMinute] = endParts;
    const gracePeriod = schedule.shift.gracePeriodMinutes ?? 0;

    const clockInManila = toManilaDate(new Date(log.clockIn!));
    const newLate = computeLateMinutes(clockInManila, startHour, startMinute, gracePeriod);

    let newUndertime = 0;
    if (log.clockOut) {
      const clockOutManila = toManilaDate(new Date(log.clockOut));
      newUndertime = computeUndertimeMinutes(clockOutManila, endHour, endMinute);
    }

    const oldLate = log.lateMinutes ?? 0;
    const oldUndertime = log.undertimeMinutes ?? 0;

    if (newLate !== oldLate || newUndertime !== oldUndertime) {
      const employee = await prisma.employee.findUnique({
        where: { id: log.employeeId },
        select: { fullName: true },
      });

      changes.push({
        logId: log.id,
        employeeName: employee?.fullName ?? 'Unknown',
        date: new Date(log.date).toLocaleDateString('en-CA'),
        oldLate,
        newLate,
        oldUndertime,
        newUndertime,
      });
    }
  }

  console.log(`Changes found: ${changes.length}\n`);

  if (changes.length === 0) {
    console.log('No changes needed. All time logs are already correct.');
    await prisma.$disconnect();
    return;
  }

  const byEmployee = new Map<string, typeof changes>();
  for (const change of changes) {
    const existing = byEmployee.get(change.employeeName) || [];
    existing.push(change);
    byEmployee.set(change.employeeName, existing);
  }

  for (const [name, empChanges] of byEmployee) {
    console.log(`Employee: ${name}`);
    for (const c of empChanges) {
      const latePart = c.oldLate !== c.newLate ? `late ${c.oldLate} → ${c.newLate}` : '';
      const utPart = c.oldUndertime !== c.newUndertime ? `undertime ${c.oldUndertime} → ${c.newUndertime}` : '';
      console.log(`  ${c.date}: ${[latePart, utPart].filter(Boolean).join(', ')}`);
    }
    console.log('');
  }

  const totalLateAdded = changes.reduce((sum, c) => sum + (c.newLate - c.oldLate), 0);
  const totalUtAdded = changes.reduce((sum, c) => sum + (c.newUndertime - c.oldUndertime), 0);

  console.log('=== Summary ===');
  console.log(`Total logs checked: ${timeLogs.length}`);
  console.log(`Total logs changed: ${changes.length}`);
  console.log(`Total late minutes added: ${totalLateAdded}`);
  console.log(`Total undertime minutes added: ${totalUtAdded}`);
  console.log('');

  if (!isApply) {
    console.log('Run with --apply to write changes to database.');
    await prisma.$disconnect();
    return;
  }

  console.log('Applying changes...');
  const batchSize = 100;
  let applied = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    try {
      await prisma.$transaction(
        batch.map(c =>
          prisma.timeLog.update({
            where: { id: c.logId },
            data: {
              lateMinutes: c.newLate,
              undertimeMinutes: c.newUndertime,
            },
          })
        )
      );
      applied += batch.length;
      console.log(`  Applied ${applied}/${changes.length}...`);
    } catch (err) {
      console.error(`  Failed to apply batch at index ${i}:`, err);
      console.error(`  Skipping ${batch.length} changes. Run script again to retry.`);
    }
  }

  console.log(`\nDone! Updated ${applied} time logs.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
