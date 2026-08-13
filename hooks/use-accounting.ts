import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Account {
  id: string
  code: string
  name: string
  type: string
  initialBalance?: number
  hasSubsidiaryLedger?: boolean
  subsidiaryType?: string
}

export interface JournalEntry {
  id: string
  date: string
  description: string
  reference?: string
  status?: string
  lines?: JournalLine[]
  branchId?: string
}

export interface JournalLine {
  id: string
  accountId: string
  debit: number
  credit: number
  account?: Account
}

export interface AccountingStats {
  cashBalance: number
  totalReceivables: number
  totalPayables: number
  netIncome: number
}

// --- Stats ---
export function useAccountingStats(params?: Record<string, string>) {
  return useQuery({
    queryKey: [...queryKeys.dashboard.all, 'accounting-stats', params],
    queryFn: ({ signal }) => api.get<AccountingStats>('/api/accounting/stats', { params, signal }),
  })
}

// --- Accounts (COA) ---
export function useAccounts(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.accounts.list(params),
    queryFn: ({ signal }) => api.get<Account[]>('/api/accounting/accounts', { params, signal }),
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Account>) =>
      api.post<Account>('/api/accounting/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.accounts.lists() })
    },
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) =>
      api.patch<Account>(`/api/accounting/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.accounts.lists() })
    },
  })
}

// --- Journal ---
export function useJournalEntries(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.journal.list(params),
    queryFn: ({ signal }) => api.get<JournalEntry[]>('/api/accounting/journal', { params, signal }),
  })
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<JournalEntry>) =>
      api.post<JournalEntry>('/api/accounting/journal', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.journal.lists() })
    },
  })
}

// --- Expenses ---
export function useExpenses(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.expenses.list(params),
    queryFn: ({ signal }) => api.get<JournalEntry[]>('/api/accounting/expenses', { params, signal }),
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/accounting/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.expenses.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.journal.lists() })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch('/api/accounting/expenses', { id, ...(data as Record<string, unknown>) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.expenses.lists() })
    },
  })
}

// --- Purchases ---
export function usePurchases(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.purchases.list(params),
    queryFn: ({ signal }) => api.get<JournalEntry[]>('/api/accounting/purchases', { params, signal }),
  })
}

export function useCreatePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/accounting/purchases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.purchases.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.journal.lists() })
    },
  })
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/api/accounting/purchases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.purchases.lists() })
    },
  })
}

// --- Sales ---
export function useSales(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.sales.list(params),
    queryFn: ({ signal }) => api.get<JournalEntry[]>('/api/accounting/sales', { params, signal }),
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/accounting/sales', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.sales.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.journal.lists() })
    },
  })
}

// --- Vendors ---
export function useVendors(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.vendors.list(params),
    queryFn: ({ signal }) => api.get<unknown[]>('/api/accounting/vendors', { params, signal }),
  })
}

export function useCreateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/accounting/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.vendors.lists() })
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/api/accounting/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.vendors.lists() })
    },
  })
}

export function useDeleteVendor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounting/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.vendors.lists() })
    },
  })
}

// --- Customers ---
export function useCustomers(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.customers.list(params),
    queryFn: ({ signal }) => api.get<unknown[]>('/api/accounting/customers', { params, signal }),
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post('/api/accounting/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.customers.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch(`/api/accounting/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.customers.lists() })
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounting/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.customers.lists() })
    },
  })
}

// --- Reports ---
export function useAccountingReport(type: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.reports.data(type, params),
    queryFn: ({ signal }) => api.get<unknown>(`/api/accounting/reports/${type}`, { params, signal }),
    enabled: !!type,
  })
}

// --- Subsidiary Ledgers ---
export function useSubsidiaryLedgers(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.subsidiaryLedgers.list(params),
    queryFn: ({ signal }) => api.get<unknown[]>('/api/accounting/subsidiary-ledgers', { params, signal }),
  })
}

// --- Reconciliation ---
export function useReconciliation(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.reconciliation.data(params),
    queryFn: ({ signal }) => api.get<unknown>('/api/accounting/reconciliation', { params, signal }),
  })
}

// --- Petty Cash ---
export function usePettyCash(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.accounting.pettyCash.list(params),
    queryFn: ({ signal }) => api.get<unknown[]>('/api/accounting/petty-cash', { params, signal }),
  })
}
