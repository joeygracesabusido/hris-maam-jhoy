# Attendance Page Design

**Date:** 2026-08-14
**Status:** Approved by user

## Business Problem

Employees and admins need a dedicated **Attendance** page in the HRIS sidebar for clocking in/out. The existing Time Logs page bundles the clock-in/out experience together with administrative features (time log tables, search, edit/delete, biometric/XCLS/CSV imports) that clutter the page. The Attendance page provides the same clock in/out function with none of the extras.

## Requirements

1. Add a new sidebar item **Attendance** (`/attendance`) under HRIS, immediately after **Time Logs**.
2. The page is like the Time Logs function but:
   - Does **NOT** display the time logs table (no "All Time Logs" / "My Time Logs" lists, search, edit, or delete).
   - Does **NOT** display the import buttons (Import Biometric, Import XCLS, Import Time Logs).
   - Does **NOT** display the Logout button (redundant — sidebar has logout).
   - **DOES** keep the **Enroll My Face** button for the EMPLOYEE role.
3. Existing Time Logs page stays unchanged.

## Page Contents (in order)

1. **Header** — "Attendance" title + "Record your daily attendance" subtitle.
   - EMPLOYEE role only: **Enroll My Face** button (opens face enrollment modal — same behavior as Time Logs).
   - No import buttons, no Logout button.
2. **Clock card** — same as Time Logs:
   - Live Manila date/time display (Asia/Manila timezone).
   - GPS status panel (multiple office locations support: shows each location with distance, ✓/✗ in-range).
   - Employee selector (ADMIN/MANAGER only; EMPLOYEE auto-linked via email).
   - Clock In / Clock Out buttons (GPS validation when office locations configured, face verification flow).
   - Today's Status panel (clock in, clock out, hours worked for the selected/own employee).
3. **Face verification modal** — same flow as Time Logs: fetch face descriptor, capture face, Euclidean distance check (< 0.6 threshold), auto-clock on success. Also used for enrollment.

## Role Behavior

- **EMPLOYEE:** own record only; no employee selector; sees Enroll My Face button.
- **ADMIN / MANAGER:** employee selector dropdown; can clock in/out on behalf of any employee; no import buttons.
- No middleware change needed — `/attendance` is not admin-restricted (same as `/time-logs`).

## Architecture

**Approach C (approved): New self-contained page reusing existing hooks/APIs.**

- Create `app/(dashboard)/attendance/page.tsx` — new page reusing existing hooks:
  - `useTimeLogs` (for today's log / Today's Status)
  - `useOfficeLocations` (GPS status)
  - `useClockIn`, `useClockOut` (mutations)
  - `useEmployeeFaceDescriptor` (face verification)
- Reuse existing API endpoints: `/api/time-logs`, `/api/office-location`, `/api/employees/[id]/face-descriptor`, `/api/employees/[id]/face`.
- Reuse the `FaceCapture` component for verification/enrollment modals.
- No changes to API routes, hooks, Prisma schema, or middleware.

## Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `app/(dashboard)/attendance/page.tsx` | New Attendance page (clock card + face modal + Enroll My Face) |
| Update | `app/(dashboard)/layout.tsx` | Add `{ href: '/attendance', label: 'Attendance', icon: Clock }` after Time Logs; add `/attendance` to HRIS active-path check |

## Example Flow

```
Sidebar HRIS > Attendance (/attendance)
  ├── Header: "Attendance" + subtitle
  │     └── EMPLOYEE only: Enroll My Face button
  ├── Clock card
  │     ├── Live Manila date/time
  │     ├── GPS status (per-location distances)
  │     ├── Employee selector (ADMIN/MANAGER)
  │     ├── Clock In / Clock Out buttons
  │     └── Today's Status (clock in / clock out / hours)
  └── Face verification modal (verify or enroll)
```

## Testing

1. `npm run lint`
2. `npm run build`
3. Manual verification:
   - `/attendance` renders clock card only — no time log table, no import buttons.
   - Enroll My Face button visible for EMPLOYEE role; opens enrollment modal.
   - Clock In/Out works with face verification (same as Time Logs).
   - Time Logs page (`/time-logs`) unchanged.
   - Sidebar shows Attendance under HRIS after Time Logs; link active state works.