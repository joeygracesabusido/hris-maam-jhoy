# Water Billing Module Design

**Date:** 2026-07-08
**Status:** Implemented

---

## Overview

A dedicated water billing module for managing external tenant water consumption, meter readings, tiered rate computation, bill generation, payment collection, and accounting integration within the HRIS Philippines system.

## Architecture

### Database Models (Prisma)

- **Tenant** - External tenants with contact info, unit assignment, status
- **WaterMeter** - Individual submeters per tenant unit (unique meterNo)
- **WaterMeterReading** - Periodic readings with previous/current/computed consumption
- **WaterRate** - Rate structures (TIERED or FLAT) with effective dates
- **WaterRateTier** - Tier rows within a rate (fromUnit, toUnit, pricePerUnit)
- **WaterBill** - Generated bills with consumption, amount, balance, status, journal entry link
- **WaterPayment** - Payments against bills with accounting integration

### Accounting Integration

- **Bill Generation:** Debit 1200 AR / Credit 4120 Service Income
- **Payment:** Debit Cash Account / Credit 1200 AR
- **Bill Void:** Reverses journal entry status to VOID

## Files Created/Modified

### Prisma & Lib
- `prisma/schema.prisma` - Added 7 models with indexes and Branch relations
- `lib/query-keys.ts` - Added `water` key factory
- `lib/water-billing.ts` - Tiered computation engine, bill number generation, account helpers
- `hooks/use-water.ts` - React Query hooks for all water entities

### API Routes (12 files)
- `app/api/water/tenants/route.ts` + `[id]/route.ts`
- `app/api/water/meters/route.ts` + `[id]/route.ts`
- `app/api/water/readings/route.ts` + `[id]/route.ts`
- `app/api/water/rates/route.ts` + `[id]/route.ts`
- `app/api/water/bills/route.ts` + `[id]/route.ts` (core billing engine)
- `app/api/water/payments/route.ts` + `[id]/route.ts`

### UI Pages (6 files)
- `app/(dashboard)/water/tenants/page.tsx`
- `app/(dashboard)/water/meters/page.tsx`
- `app/(dashboard)/water/readings/page.tsx`
- `app/(dashboard)/water/rates/page.tsx`
- `app/(dashboard)/water/bills/page.tsx` + `[id]/print/page.tsx`
- `app/(dashboard)/water/payments/page.tsx`

### Navigation
- `app/(dashboard)/layout.tsx` - Added Water Billing sidebar section (adminOnly)
- `middleware.ts` - Added `/water` to EMPLOYEE restricted paths

## Key Features

- **Tiered Rate Engine:** `computeTieredAmount()` handles multi-tier pricing with proper overflow
- **Bill Generation:** Combined billing month/year with rate, auto-skips already-billed meters
- **Journal Entry Integration:** Bills and payments auto-create balanced double-entry records
- **Payment Tracking:** Supports Cash/Check/Bank Transfer with balance recalculation
- **PDF Printing:** Printable bill view with reading details, amount breakdown, payment history
- **Branch-Aware:** All models support branchId for multi-branch filtering
- **Role-Based:** Admin-only access (EMPLOYEE role redirected)
- **Validation:** No negative consumption, spike detection, no duplicate bills per period
