# Late & Undertime Recalculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recalculate lateMinutes and undertimeMinutes for all existing time logs using the fixed computation utilities.

**Architecture:** Standalone TypeScript script (`scripts/recalculate-late.ts`) that fetches all time logs, matches them to shift schedules, recalculates late/undertime, and optionally writes changes to the database.

**Tech Stack:** TypeScript, Prisma, tsx, date-fns, existing `lib/late-computation.ts` utilities

---

### Task 1: Create the recalculation script

**Files:**
- Create: `scripts/recalculate-late.ts`

- [ ] **Step 1: Create the script with imports, timezone helper, and argument parsing**

```typescript
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

  // Group changes by employee for readable output
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

  // Apply changes in batches of 100
  console.log('Applying changes...');
  const batchSize = 100;
  let applied = 0;

  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    const promises = batch.map(c =>
      prisma.timeLog.update({
        where: { id: c.logId },
        data: {
          lateMinutes: c.newLate,
          undertimeMinutes: c.newUndertime,
        },
      })
    );
    await Promise.all(promises);
    applied += batch.length;
    console.log(`  Applied ${applied}/${changes.length}...`);
  }

  console.log(`\nDone! Updated ${applied} time logs.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script compiles**

Run: `npx tsc --noEmit scripts/recalculate-late.ts`
Expected: No errors (or only module resolution warnings that are normal for standalone scripts)

- [ ] **Step 3: Run in dry-run mode**

Run: `npx tsx scripts/recalculate-late.ts`
Expected: Prints summary of changes found, including Jerome's late minutes

- [ ] **Step 4: Run in apply mode**

Run: `npx tsx scripts/recalculate-late.ts --apply`
Expected: Updates affected time logs, prints confirmation

- [ ] **Step 5: Verify Jerome's time logs are corrected**

Run: `npx tsx check_jerome_may12.ts`
Expected: Jerome's May 12 time log shows lateMinutes > 0 (should be ~562 min)

- [ ] **Step 6: Commit**

```bash
git add scripts/recalculate-late.ts
git commit -m "feat: add late/undertime recalculation script for historical time logs"
```
