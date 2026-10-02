import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { buildRoleBasedWhereClause, getRequestSession } from '@/lib/auth-helpers';
import { computeLateMinutes, computeUndertimeMinutes, parseTimeString, recomputeTimeLogFromSchedule } from '@/lib/late-computation';

export const dynamic = 'force-dynamic';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Return the current time in Manila timezone as a Date object.
 * The returned Date's getTime() = actual UTC + 8h, so:
 *   - getUTCHours() gives Manila hours
 *   - getUTCDate()  gives Manila day-of-month
 *
 * This avoids timezone-dependent string parsing that breaks on Vercel (UTC runtime).
 */
function getManilaNow(): Date {
  return new Date(Date.now() + MANILA_OFFSET_MS);
}

/**
 * Return the start/end of today's Manila day as fake-UTC timestamps.
 * Since dates are stored via getManilaNow() (Date.now() + 8h), the query
 * range must also use the same fake-UTC space to match correctly.
 * 
 * Previously this subtracted MANILA_OFFSET_MS which converted to real-UTC,
 * causing a mismatch after 4 PM Manila time (the fake-UTC stored timestamps
 * exceeded the real-UTC range end).
 */
function getManilaToday(): { start: Date; end: Date } {
  const now = getManilaNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

/**
 * Convert a stored fake-UTC Date to a Manila-day date range for Prisma queries.
 * Uses the same fake-UTC convention as getManilaNow() (no offset subtraction).
 */
function getManilaDayRange(utcDate: Date): { start: Date; end: Date } {
  // The stored date already uses fake-UTC (actual UTC + 8h), so getUTCDate()
  // already gives the Manila day-of-month. No additional offset needed.
  const y = utcDate.getUTCFullYear();
  const m = utcDate.getUTCMonth();
  const d = utcDate.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
  };
}

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Get all active office locations
async function getActiveOfficeLocations() {
  try {
    const locations = await prisma.officeLocation.findMany({
      where: { isActive: true },
    });
    return locations;
  } catch (error) {
    console.error('Error fetching office locations:', error);
    return [];
  }
}

// Validate GPS location against all active office geofences
async function validateGPS(latitude: number, longitude: number) {
  const activeLocations = await getActiveOfficeLocations();

  // If no office locations are set, allow by default
  if (activeLocations.length === 0) {
    return { valid: true, distance: 0 };
  }

  let minDistance = Infinity;
  let minRadius = 0;

  for (const location of activeLocations) {
    const distance = calculateDistance(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance <= location.radius) {
      return {
        valid: true,
        distance,
        radius: location.radius,
      };
    }

    if (distance < minDistance) {
      minDistance = distance;
      minRadius = location.radius;
    }
  }

  return {
    valid: false,
    distance: minDistance,
    radius: minRadius,
  };
}

export async function GET(request: Request) {
  try {
    let userEmail: string, userRole: string;
    try {
      const session = await getRequestSession(request);
      userEmail = session.userEmail;
      userRole = session.userRole;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');

    // Build role-based where clause
    const where = await buildRoleBasedWhereClause(userEmail, userRole, employeeIdParam ?? undefined);

    const timeLogs = await prisma.timeLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const employeeIds = Array.from(new Set(timeLogs.map(log => log.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, fullName: true, employeeId: true },
    });
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Fetch all active holidays
    const holidays = await prisma.holiday.findMany({
      where: { isActive: true, branchId: null },
    })
    const holidayMap = new Map(
      holidays.map(h => [new Date(h.date).toLocaleDateString(), h])
    );

    const formattedLogs = await Promise.all(timeLogs.map(async (log) => {
      const emp = employeeMap.get(log.employeeId);
      const logDateStr = new Date(log.date).toLocaleDateString();
      const holiday = holidayMap.get(logDateStr) || null;
      
      const { start: dayStart, end: dayEnd } = getManilaDayRange(new Date(log.date));
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId: log.employeeId,
          date: {
            gte: dayStart,
            lte: dayEnd,
          }
        },
        include: {
          shift: true
        }
      });

      return {
        ...log,
        shift: schedule?.shift || null,
        holiday,
        employee: emp ? {
          fullName: emp.fullName,
          employeeId: emp.employeeId,
        } : { fullName: 'Unknown', employeeId: 'N/A' },
      };
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error('Error fetching time logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, type: legacyType, latitude, longitude, clockIn, clockOut, location, date: _unusedDate } = body;

    // Support both legacy format ({ type, latitude, longitude }) and hook format ({ clockIn/clockOut, location: { lat, lon } })
    const type = clockIn ? 'clockIn' : clockOut ? 'clockOut' : legacyType;
    const lat = latitude ?? location?.lat;
    const lon = longitude ?? location?.lon;

    if (!employeeId || !type) {
      return NextResponse.json({ error: 'Employee ID and type are required' }, { status: 400 });
    }

    // Validate GPS location if provided
    let gpsValid = true;
    let gpsDistance = 0;
    let gpsRadius = 0;
    
    if (lat !== undefined && lon !== undefined) {
      const gpsResult = await validateGPS(lat, lon);
      gpsValid = gpsResult.valid;
      gpsDistance = gpsResult.distance;
      gpsRadius = gpsResult.radius ?? 0;
    } else {
      // If no GPS provided, check if office location is configured
      const activeLocations = await getActiveOfficeLocations();
      if (activeLocations.length > 0) {
        return NextResponse.json(
          { error: 'GPS location is required. Please enable location services.' },
          { status: 400 }
        );
      }
    }

    // Reject if outside geofence
    if (!gpsValid) {
      return NextResponse.json(
        { 
          error: `You must be within ${gpsRadius} meters of the office to ${type}. Current distance: ${Math.round(gpsDistance)} meters` 
        },
        { status: 403 }
      );
    }

    const now = getManilaNow();
    const { start: todayStart, end: todayEnd } = getManilaToday();

    const existingLog = await prisma.timeLog.findFirst({
      where: {
        employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });

    if (type === 'clockIn') {
      if (existingLog && existingLog.clockIn) {
        return NextResponse.json({ error: 'You have already clocked in today' }, { status: 400 });
      }

      // Calculate lateness if a shift is assigned
      let lateMinutes = 0;
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: { shift: true }
      });

      if (schedule?.shift && !schedule.shift.isOff && schedule.shift.startTime !== '-') {
        const timeParts = parseTimeString(schedule.shift.startTime);
        if (timeParts) {
          const [sHour, sMin] = timeParts;
          const gracePeriod = schedule.shift.gracePeriodMinutes ?? 0;
          // now is Manila-adjusted; use setUTCHours to set the time components consistently
          lateMinutes = computeLateMinutes(now, sHour, sMin, gracePeriod);
        }
      }

      if (existingLog) {
        await prisma.timeLog.update({
          where: { id: existingLog.id },
          data: {
            clockIn: now,
            lateMinutes,
            clockInLatitude: lat,
            clockInLongitude: lon,
          },
        });
      } else {
        await prisma.timeLog.create({
          data: {
            employeeId,
            date: now,
            clockIn: now,
            lateMinutes,
            clockInLatitude: lat,
            clockInLongitude: lon,
          },
        });
      }
      return NextResponse.json({ message: 'Clock in recorded successfully' });
    }

    if (type === 'clockOut') {
      if (!existingLog) {
        return NextResponse.json({ error: 'You have not clocked in today' }, { status: 400 });
      }
      if (existingLog.clockOut) {
        return NextResponse.json({ error: 'You have already clocked out today' }, { status: 400 });
      }

      const clockInTime = new Date(existingLog.clockIn!);
      const hoursWorked = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // Calculate undertime if a shift is assigned
      let undertimeMinutes = 0;
      const schedule = await prisma.shiftSchedule.findFirst({
        where: {
          employeeId,
          date: { gte: todayStart, lte: todayEnd },
        },
        include: { shift: true }
      });

      if (schedule?.shift && !schedule.shift.isOff && schedule.shift.endTime !== '-') {
        const timeParts = parseTimeString(schedule.shift.endTime);
        if (timeParts) {
          const [eHour, eMin] = timeParts;
          undertimeMinutes = computeUndertimeMinutes(now, eHour, eMin);
        }
      }

      await prisma.timeLog.update({
        where: { id: existingLog.id },
        data: {
          clockOut: now,
          workHours: Math.round(hoursWorked * 100) / 100,
          undertimeMinutes,
            clockOutLatitude: lat,
            clockOutLongitude: lon,
        },
      });

      return NextResponse.json({ message: 'Clock out recorded successfully' });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error recording time log:', error);
    return NextResponse.json({ error: 'Failed to record time log' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    let userRole: string;
    try {
      const session = await getRequestSession(request);
      userRole = session.userRole;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Only admins and managers can update time logs' }, { status: 403 });
    }

    const body = await request.json();
    const { id, clockIn, clockOut, date } = body;

    if (!id) {
      return NextResponse.json({ error: 'Time log ID is required' }, { status: 400 });
    }

    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Date must be YYYY-MM-DD' }, { status: 400 });
    }

    const existing = await prisma.timeLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Time log not found' }, { status: 404 });
    }

    // In this codebase timestamps are stored in fake-UTC (Manila wall clock
    // as UTC fields), so the ISO day always equals the Manila calendar day.
    const dayKeyOf = (d: Date): string => d.toISOString().split('T')[0];
    const newDayKey = date ?? dayKeyOf(new Date(existing.date));
    const [year, month, day] = newDayKey.split('-').map(Number);

    // Anchor a wall-clock time onto the (possibly new) day. Provided ISO
    // strings from the edit dialog are already anchored by the frontend;
    // re-anchoring here keeps kept values correct when only the date changes.
    const anchorToDay = (value: Date): Date => {
      return new Date(
        Date.UTC(year, month - 1, day, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), 0)
      );
    };

    const parseTimestamp = (value: unknown): Date | null | undefined => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      const parsed = new Date(String(value));
      if (isNaN(parsed.getTime())) return undefined;
      return parsed;
    };

    const parsedClockIn = parseTimestamp(clockIn);
    const parsedClockOut = parseTimestamp(clockOut);
    if ((clockIn !== undefined && parsedClockIn === undefined) ||
        (clockOut !== undefined && parsedClockOut === undefined)) {
      return NextResponse.json({ error: 'Invalid clock in/out time' }, { status: 400 });
    }

    const baseClockIn = parsedClockIn === undefined
      ? (existing.clockIn ? new Date(existing.clockIn) : null)
      : parsedClockIn;
    const baseClockOut = parsedClockOut === undefined
      ? (existing.clockOut ? new Date(existing.clockOut) : null)
      : parsedClockOut;

    const newClockIn = baseClockIn ? anchorToDay(baseClockIn) : null;
    const newClockOut = baseClockOut ? anchorToDay(baseClockOut) : null;

    if (!newClockIn && newClockOut) {
      return NextResponse.json(
        { error: 'Clock in is required when clock out is set' },
        { status: 400 }
      );
    }
    if (newClockIn && newClockOut && newClockOut.getTime() <= newClockIn.getTime()) {
      return NextResponse.json(
        { error: 'Clock out must be after clock in' },
        { status: 400 }
      );
    }

    // Duplicate-day guard: the schema unique key is on the exact timestamp,
    // so compare calendar days against the employee's other logs.
    const siblings = await prisma.timeLog.findMany({
      where: { employeeId: existing.employeeId, NOT: { id } },
      select: { id: true, date: true },
    });
    const clash = siblings.find((sib) => dayKeyOf(new Date(sib.date)) === newDayKey);
    if (clash) {
      return NextResponse.json(
        { error: 'Another time log already exists for this employee on the selected date' },
        { status: 409 }
      );
    }

    let workHours = 0;
    if (newClockIn && newClockOut) {
      workHours = Math.round(((newClockOut.getTime() - newClockIn.getTime()) / 3600000) * 100) / 100;
    }

    // Recompute late/undertime against the shift schedule on the (new) date.
    const schedule = await prisma.shiftSchedule.findFirst({
      where: {
        employeeId: existing.employeeId,
        date: {
          gte: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
        },
      },
      include: { shift: true },
    });
    const { lateMinutes, undertimeMinutes } = recomputeTimeLogFromSchedule(
      { clockIn: newClockIn, clockOut: newClockOut },
      schedule?.shift
    );

    const updateData: Record<string, Date | number | boolean | string | null> = {
      workHours,
      lateMinutes,
      undertimeMinutes,
      isEdited: true,
    };
    if (date !== undefined) {
      // Noon UTC anchor keeps the calendar day stable across timezones
      // (same convention as the XCLS import).
      updateData.date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    }
    if (parsedClockIn !== undefined || date !== undefined) updateData.clockIn = newClockIn;
    if (parsedClockOut !== undefined || date !== undefined) updateData.clockOut = newClockOut;

    const updated = await prisma.timeLog.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating time log:', error);
    return NextResponse.json({ error: 'Failed to update time log' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    let _userRole: string;
    try {
      const session = await getRequestSession(request);
      _userRole = session.userRole;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (_userRole !== 'ADMIN' && _userRole !== 'MANAGER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Time log ID is required' }, { status: 400 });
    }

    await prisma.timeLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Time log deleted successfully' });
  } catch (error) {
    console.error('Error deleting time log:', error);
    return NextResponse.json({ error: 'Failed to delete time log' }, { status: 500 });
  }
}
