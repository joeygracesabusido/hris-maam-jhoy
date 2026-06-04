/**
 * Late & Undertime Computation Utility
 * ======================================
 * DOLE-compliant computation for tardiness and undertime deductions.
 *
 * Rules:
 * - Grace period: configurable per shift (default 0 minutes)
 * - Late threshold: 1 minute after grace period
 * - Undertime: clock-out before scheduled end time
 * - All times computed in UTC to avoid timezone drift on Vercel
 */

/**
 * Compute late minutes given actual clock-in time vs scheduled start.
 *
 * @param clockInUTC - The actual clock-in time (Date object, UTC)
 * @param scheduledStartHour - Scheduled start hour (0-23)
 * @param scheduledStartMinute - Scheduled start minute (0-59)
 * @param gracePeriodMinutes - Grace period in minutes (default 0)
 * @returns Late minutes (0 if not late or within grace period)
 */
export function computeLateMinutes(
  clockInUTC: Date,
  scheduledStartHour: number,
  scheduledStartMinute: number,
  gracePeriodMinutes: number = 0
): number {
  const scheduledTime = new Date(clockInUTC.getTime());
  scheduledTime.setUTCHours(scheduledStartHour, scheduledStartMinute, 0, 0);

  const graceEndTime = new Date(scheduledTime.getTime() + gracePeriodMinutes * 60000);

  if (clockInUTC.getTime() > graceEndTime.getTime()) {
    return Math.floor((clockInUTC.getTime() - scheduledTime.getTime()) / 60000);
  }

  return 0;
}

/**
 * Compute undertime minutes given actual clock-out time vs scheduled end.
 *
 * @param clockOutUTC - The actual clock-out time (Date object, UTC)
 * @param scheduledEndHour - Scheduled end hour (0-23)
 * @param scheduledEndMinute - Scheduled end minute (0-59)
 * @returns Undertime minutes (0 if not early)
 */
export function computeUndertimeMinutes(
  clockOutUTC: Date,
  scheduledEndHour: number,
  scheduledEndMinute: number
): number {
  const scheduledEndTime = new Date(clockOutUTC.getTime());
  scheduledEndTime.setUTCHours(scheduledEndHour, scheduledEndMinute, 0, 0);

  const diffMs = scheduledEndTime.getTime() - clockOutUTC.getTime();

  if (diffMs <= 60000) return 0;

  return Math.floor(diffMs / 60000);
}

/**
 * Parse a "HH:MM" time string into hour and minute components.
 *
 * @param timeStr - Time string in "HH:MM" format
 * @returns [hour, minute] or null if invalid
 */
export function parseTimeString(timeStr: string): [number, number] | null {
  if (!timeStr || timeStr === '-') return null;

  const parts = timeStr.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

  return [parts[0], parts[1]];
}

/**
 * Compute late deduction amount in PHP.
 *
 * Formula: (lateMinutes / 60) * hourlyRate
 * hourlyRate = monthlySalary / 26 / 8 (DOLE standard)
 *
 * @param lateMinutes - Total late minutes
 * @param monthlySalary - Employee monthly salary
 * @returns Deduction amount in PHP
 */
export function computeLateDeduction(lateMinutes: number, monthlySalary: number, divisor: number = 26): number {
  if (lateMinutes <= 0 || monthlySalary <= 0) return 0;

  const hourlyRate = monthlySalary / divisor / 8;
  return Math.round((lateMinutes / 60) * hourlyRate * 100) / 100;
}

/**
 * Compute undertime deduction amount in PHP.
 *
 * Formula: (undertimeMinutes / 60) * hourlyRate
 *
 * @param undertimeMinutes - Total undertime minutes
 * @param monthlySalary - Employee monthly salary
 * @param divisor - Monthly working days divisor (default 26)
 * @returns Deduction amount in PHP
 */
export function computeUndertimeDeduction(undertimeMinutes: number, monthlySalary: number, divisor: number = 26): number {
  if (undertimeMinutes <= 0 || monthlySalary <= 0) return 0;

  const hourlyRate = monthlySalary / divisor / 8;
  return Math.round((undertimeMinutes / 60) * hourlyRate * 100) / 100;
}

export interface ShiftLike {
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number | null;
  isOff: boolean;
}

export interface TimeLogLike {
  clockIn: Date | string | null;
  clockOut: Date | string | null;
}

export interface CorrectedAttendance {
  lateMinutes: number;
  undertimeMinutes: number;
  hasSchedule: boolean;
}

/**
 * Recompute late/undertime minutes for a single time log against its shift schedule.
 *
 * Returns 0/0 when there is no schedule, when the shift is OFF, or when the shift
 * has no defined start/end times. This mirrors the behavior of the clock-in and
 * XCLS import paths so values stay consistent across the system.
 *
 * Use this in payroll compute to heal time logs where the schedule was added
 * retroactively (i.e. clock-in happened before any ShiftSchedule existed).
 */
export function recomputeTimeLogFromSchedule(
  timeLog: TimeLogLike,
  shift: ShiftLike | null | undefined
): CorrectedAttendance {
  if (!shift || shift.isOff) {
    return { lateMinutes: 0, undertimeMinutes: 0, hasSchedule: false };
  }

  if (!shift.startTime || shift.startTime === '-' || !shift.endTime || shift.endTime === '-') {
    return { lateMinutes: 0, undertimeMinutes: 0, hasSchedule: true };
  }

  const startParts = parseTimeString(shift.startTime);
  const endParts = parseTimeString(shift.endTime);
  if (!startParts || !endParts) {
    return { lateMinutes: 0, undertimeMinutes: 0, hasSchedule: true };
  }

  const [startHour, startMinute] = startParts;
  const [endHour, endMinute] = endParts;
  const gracePeriod = shift.gracePeriodMinutes ?? 0;

  let lateMinutes = 0;
  if (timeLog.clockIn) {
    const clockIn = timeLog.clockIn instanceof Date ? timeLog.clockIn : new Date(timeLog.clockIn);
    lateMinutes = computeLateMinutes(clockIn, startHour, startMinute, gracePeriod);
  }

  let undertimeMinutes = 0;
  if (timeLog.clockOut) {
    const clockOut = timeLog.clockOut instanceof Date ? timeLog.clockOut : new Date(timeLog.clockOut);
    undertimeMinutes = computeUndertimeMinutes(clockOut, endHour, endMinute);
  }

  return { lateMinutes, undertimeMinutes, hasSchedule: true };
}
