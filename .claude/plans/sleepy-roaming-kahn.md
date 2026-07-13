# TanStack Query Migration for Journal & Expenses Pages

## Context

The journal page at `http://localhost:3000/accounting/journal` and the expenses page at `http://localhost:3000/accounting/expenses` currently fetch data with `useState` + `useEffect` + raw `fetch()`. This causes:

- **No caching** — switching branches and back triggers a fresh fetch every time
- **Stale closure bugs** — the expenses page `useCallback` for `fetchExpenses` was missing `selectedBranch` in its deps (we fixed that, but the underlying pattern is fragile)
- **Manual refetch wiring** — every mutation calls `fetchExpenses()` / `fetchData()` by hand
- **No background refetch / no stale-while-revalidate** — UI shows "Loading…" even when cached data exists

Migrating to TanStack Query gives us automatic caching keyed by `(branchId, page, search)`, background refetching on window focus, automatic invalidation after mutations, and `isPending`/`isError` state.

## Approach

### 1. Install TanStack Query

Add `@tanstack/react-query` (latest 5.x — compatible with React 18) to `package.json` and run `npm install`.

Optionally add `@tanstack/react-query-devtools` (dev only) for debugging.

### 2. Create a QueryClient provider

Create `components/providers.tsx` (`'use client'`) that wraps children with `<QueryClientProvider>` using a single `QueryClient` instance created with sensible defaults:

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,         // 30s before background refetch
        gcTime: 5 * 60_000,        // 5min garbage collection
        refetchOnWindowFocus: false, // match existing UX (no surprise refetches)
        retry: 1,
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

### 3. Mount the provider in the root layout

Update `app/layout.tsx` to wrap `<ThemeProvider>` with `<Providers>` (Providers wraps ThemeProvider so query context is outermost). This means EVERY page in the app gets query caching — including auth pages — which is fine since `useQuery` is only called in pages that opt in.

### 4. Migrate the journal page

In `app/(dashboard)/accounting/journal/page.tsx`:

- Remove the `useState` blocks for `entries`, `loading`, `total`, `totalPages`, and the `fetchData` `useCallback`.
- Replace with a `useQuery` for the list, keyed by `['journal', branchId, page, debouncedSearch]`:
  ```ts
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['journal', selectedBranch?.id ?? null, page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch) params.set('branchId', selectedBranch.id);
      params.set('page', page.toString());
      params.set('pageSize', String(pageSize));
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/accounting/journal?${params}`);
      if (!res.ok) throw new Error('Failed to fetch journal entries');
      return res.json();
    },
  });
  ```
  Destructure `entries`, `pagination` from `data`.
- Replace `accounts` / `subsidiaryLedgers` fetches with two additional `useQuery`s (`['accounts', branchId]`, `['subsidiary-ledgers', branchId]`).
- Replace the POST/PUT/DELETE `fetch` calls in `handleSubmit` with a `useMutation` that calls `queryClient.invalidateQueries({ queryKey: ['journal'] })` on success. Show toasts in `onSuccess` / `onError`.
- Keep the existing `useEffect` for search debouncing — that's UI state, not server state.
- Map `isPending` → existing loading UI; `isError` → existing error fallback (`console.error` + empty state). Toasts remain for user-facing feedback.

### 5. Migrate the expenses page

In `app/(dashboard)/accounting/expenses/page.tsx`:

- Remove the `expenses`, `loading`, `accounts`, `vendors`, `cashAccounts` `useState`s and the `fetchExpenses` / `fetchInitialData` `useCallback`s.
- Replace with three `useQuery`s:
  - `['expenses', branchId, search, statusFilter]`
  - `['accounts']` (no branch filter needed for COA — accounts are global)
  - `['vendors']`
  - Derive `cashAccounts` and `expenseAccounts` via `useMemo` from the accounts query (preserves current filtering logic).
- Replace `handleSubmit` (POST), `handleUpdate` (PATCH), `handleStatusChange` (PATCH), `handleVoidExpense` (PATCH), `handleDelete` (DELETE) with `useMutation`s. Each `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['expenses'] })`.
- Preserve all existing form state, dialog state, and validation. The mutations only wrap the fetch.
- Map `isPending` → existing loading UI; errors via toast.

### 5. Verification

- After `npm install`, `npm run dev` should still start cleanly (no TS errors).
- Hard-refresh `/accounting/journal` — entries should load identically.
- Switch branches via the `BranchSelector` — query should fire with new `branchId` key, old data should disappear, new data should load. Switch back — the previous branch's data should appear instantly (cached, no loading spinner unless stale).
- Submit a new journal entry — toast appears, modal closes, list updates without manual refetch.
- Delete an expense — toast appears, list updates.
- Open React Query DevTools (if installed) and confirm `['journal', ...]` and `['expenses', ...]` query entries exist and update on actions.

## Critical files

**New / changed:**
- `package.json` — add `@tanstack/react-query` dependency
- `components/providers.tsx` — NEW. `QueryClientProvider` wrapper
- `app/layout.tsx` — wrap `<ThemeProvider>` with `<Providers>`
- `app/(dashboard)/accounting/journal/page.tsx` — replace `useEffect`/`fetch` with `useQuery`/`useMutation`
- `app/(dashboard)/accounting/expenses/page.tsx` — replace `useEffect`/`fetch` with `useQuery`/`useMutation`

**Untouched (server side already does the right thing):**
- `app/api/accounting/journal/route.ts` — branch filter already applied (line 124-126)
- `app/api/accounting/expenses/route.ts` — branch filter already applied (line 126-128)

## Out of scope

- Migrating any other page (HRIS, payroll, etc.) — the user can opt-in later per page.
- Optimistic updates (we'll use plain invalidation-on-success; optimistic is overkill for forms that show a save spinner).
- Refactoring the form state — we'll leave `useState` for form data alone; only server state moves to TanStack Query.
