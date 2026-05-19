# Late & Undertime Recalculation Design Spec

**Date:** 2026-05-06
**Author:** Senior Full-Stack Engineer
**Status:** Draft — Pending Review

---

## Problem Statement

Historical time logs have `lateMinutes=0` and `undertimeMinutes=0` due to timezone bugs in the original clock-in/clock-out logic. This causes payroll to compute zero late/undertime deductions even when employees were tardy.

## Scope

- Recalculate `lateMinutes` and `undertimeMinutes` for ALL existing time logs
- Use the fixed utilities from `lib/late-computation.ts`
- Dry-run mode (default) and apply mode (`--apply` flag)
- No payroll recalculation — only time logs are updated. Payroll must be re-computed manually after this script runs.

## Architecture

### File: `scripts/recalculate-late.ts`

### Algorithm

```
1. Connect to Prisma
2. Fetch ALL time logs where clockIn IS NOT NULL
3. Fetch ALL shift schedules (batched by employee to minimize queries)
4. For each time log:
   a. Find the employee's shift schedule for that date
   b. If no schedule OR shift.isOff → skip (no change)
   c. Parse shift.startTime → [startHour, startMinute]
   d. Parse shift.endTime → [endHour, endMinute]
   e. Get gracePeriod = shift.gracePeriodMinutes ?? 0
   f. Recalculate late: computeLateMinutes(clockIn, startHour, startMinute, gracePeriod)
   g. If clockOut exists: recalculate undertime: computeUndertimeMinutes(clockOut, endHour, endMinute)
   h. If newLate !== oldLate OR newUndertime !== oldUndertime → record change
5. Print summary:
   - Total logs checked
   - Total logs changed
   - Per-employee breakdown (employee name, date, oldLate→newLate, oldUT→newUT)
6. If --apply:
   - Batch update time logs in groups of 100
   - Print confirmation
```

### Timezone Handling

The clock-in API uses `getManilaNow()` which creates a Date object where UTC fields equal Manila local time. The recalculation script must use the same approach:

```typescript
function toManilaDate(utcDate: Date): Date {
  const manilaStr = utcDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  return new Date(manilaStr);
}
```

Then pass the Manila-adjusted date to `computeLateMinutes()` which uses `setUTCHours()` for comparison.

### Dependencies

- `@/lib/late-computation` — `computeLateMinutes`, `computeUndertimeMinutes`, `parseTimeString`
- `@/lib/prisma` — Prisma singleton client
- `date-fns` — `startOfDay`, `endOfDay`

### Run Commands

```bash
# Dry run (default — prints changes, no DB writes)
npx tsx scripts/recalculate-late.ts

# Apply changes (writes to database)
npx tsx scripts/recalculate-late.ts --apply
```

### Output Format

```
=== Late & Undertime Recalculation ===
Mode: DRY RUN

Checking 1,247 time logs...

Changes found: 342

Employee: JEROME R. SABUSIDO
  2026-05-04: late 0 → 427, undertime 0 → 0
  2026-05-05: late 0 → 295, undertime 0 → 0
  2026-05-12: late 0 → 562, undertime 0 → 0
  ...

Employee: MARIA DELA CRUZ
  2026-04-15: late 0 → 15, undertime 0 → 30
  ...

=== Summary ===
Total logs checked: 1,247
Total logs changed: 342
Total late minutes added: 12,450
Total undertime minutes added: 3,210

Run with --apply to write changes to database.
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wrong timezone math | Use same `getManilaNow()` pattern as clock-in API |
| Missing shift schedules | Skip logs with no schedule (no change) |
| Large dataset timeout | Process in batches, print progress every 100 logs |
| Accidental overwrite | Dry-run default, explicit `--apply` flag required |
| Prisma client locked | Restart dev server before running script |

## Success Criteria

1. Script runs without errors in dry-run mode
2. Dry-run output shows expected changes (e.g., Jerome's May 12 late = 562 min)
3. `--apply` mode updates all affected time logs
4. Re-running payroll for Jerome May 1-15 shows correct late deduction

## Post-Script Actions

After running `--apply`:
1. Existing payroll records are NOT modified — they retain their original late/undertime values
2. Only newly computed payroll (after this script) will reflect the corrected time log data
3. If historical payroll correction is needed, it must be done manually via a separate process
