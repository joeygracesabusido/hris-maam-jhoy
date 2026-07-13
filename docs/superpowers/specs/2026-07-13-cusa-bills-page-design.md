# CUSA Bills Page Design

## Overview
Create the CUSA bills management page with bill generation and payment recording functionality.

## Requirements

### UI Components
1. **Header**: Title "CUSA Bills" with FileText icon, "Generate Bills" button
2. **Filters**: Status dropdown, Quarter dropdown (1-4), Year input
3. **Bills Table**: Columns for Bill No, Unit, Tenant, Quarter, Amount, Status, Due Date, Actions
4. **Status Badges**: PAID (green), UNPAID (yellow), OVERDUE (red)
5. **Actions**: Record Payment (CreditCard icon, green) for UNPAID bills, Print Bill (Printer icon)

### Dialogs
1. **Generate Bills Dialog**: Quarter (1-4), Year, Due Date fields
2. **Record Payment Dialog**: Bill info display, Payment Date, Payment Method (Cash/Check/Bank Transfer), Reference No

### Hooks to Use
- `useCusaBills(filters)` - list bills
- `useGenerateCusaBills()` - generate bills
- `useRecordCusaPayment()` - record payment

## Implementation Approach
Follow existing patterns from water bills page and CUSA units page. Create a new page at `app/(dashboard)/cusa/bills/page.tsx` with similar structure to water bills page but adapted for CUSA billing (quarterly instead of monthly).

## Data Flow
1. Page loads → fetch bills with filters
2. Generate bills → POST to /api/cusa/bills with quarter/year/dueDate
3. Record payment → POST to /api/cusa/payments with billId/amount/date/method/reference
4. Refresh bills list after mutations

## Status Handling
- Check bill status to determine action availability
- UNPAID bills can have payments recorded
- All bills can be printed
- Status badges color-coded per requirements