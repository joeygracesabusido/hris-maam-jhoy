import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface CusaUnit {
  id: string
  tenantId: string
  tenant: { id: string; fullName: string; email?: string }
  unitNo: string
  floor: number
  zone?: string
  areaSqm: number
  status: string
  leaseStart?: string
  leaseEnd?: string
  branchId?: string
}

export interface CusaRateTier {
  id: string
  fromArea: number
  toArea?: number
  pricePerSqm: number
  sequence: number
}

export interface CusaRate {
  id: string
  name: string
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  tiers: CusaRateTier[]
}

export interface CusaBill {
  id: string
  billNo: string
  unitId: string
  unit: CusaUnit
  tenantId: string
  tenant: { id: string; fullName: string }
  rateId: string
  billingQuarter: number
  billingYear: number
  billingMonths?: number
  areaSqm: number
  ratePerSqm: number
  totalAmount: number
  amountPaid: number
  balance: number
  dueDate: string
  status: string
  payments: CusaPayment[]
}

export interface CusaPayment {
  id: string
  billId: string
  paymentNo: string
  amount: number
  paymentDate: string
  paymentMethod: string
  referenceNo?: string
}

// Units
export function useCusaUnits(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cusa.units.list(filters as Record<string, string>),
    queryFn: ({ signal }) => api.get<CusaUnit[]>('/api/cusa/units', { params: filters as Record<string, string>, signal }),
  })
}

export function useCusaUnit(id: string) {
  return useQuery({
    queryKey: queryKeys.cusa.units.detail(id),
    queryFn: ({ signal }) => api.get<CusaUnit>(`/api/cusa/units/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateCusaUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CusaUnit>) => api.post<CusaUnit>('/api/cusa/units', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.units.lists() }),
  })
}

export function useUpdateCusaUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CusaUnit> }) =>
      api.patch<CusaUnit>(`/api/cusa/units/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.units.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.units.detail(id) })
    },
  })
}

export function useDeleteCusaUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/cusa/units/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.units.lists() }),
  })
}

// Rates
export function useCusaRates(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cusa.rates.list(filters as Record<string, string>),
    queryFn: ({ signal }) => api.get<CusaRate[]>('/api/cusa/rates', { params: filters as Record<string, string>, signal }),
  })
}

export function useCusaRate(id: string) {
  return useQuery({
    queryKey: queryKeys.cusa.rates.detail(id),
    queryFn: ({ signal }) => api.get<CusaRate>(`/api/cusa/rates/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateCusaRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Partial<CusaRate>, 'tiers'> & { tiers: Omit<CusaRateTier, 'id'>[] }) =>
      api.post<CusaRate>('/api/cusa/rates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.rates.lists() }),
  })
}

export function useUpdateCusaRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Partial<CusaRate>, 'tiers'> & { tiers?: Omit<CusaRateTier, 'id'>[] } }) =>
      api.patch<CusaRate>(`/api/cusa/rates/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.rates.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.rates.detail(id) })
    },
  })
}

// Bills
export function useCusaBills(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cusa.bills.list(filters as Record<string, string>),
    queryFn: ({ signal }) => api.get<CusaBill[]>('/api/cusa/bills', { params: filters as Record<string, string>, signal }),
  })
}

export function useCusaBill(id: string) {
  return useQuery({
    queryKey: queryKeys.cusa.bills.detail(id),
    queryFn: ({ signal }) => api.get<CusaBill>(`/api/cusa/bills/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useGenerateCusaBills() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { billingQuarter: number; billingYear: number; dueDate: string; billingMonths?: number }) =>
      api.post<CusaBill[]>('/api/cusa/bills', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.bills.lists() }),
  })
}

export function useUpdateCusaBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; status: string }) =>
      api.patch<CusaBill>(`/api/cusa/bills/${data.id}`, { status: data.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.bills.lists() }),
  })
}

export function useDeleteCusaBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/cusa/bills/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cusa.bills.lists() }),
  })
}

// Payments
export function useCusaPayments(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cusa.payments.list(filters as Record<string, string>),
    queryFn: ({ signal }) => api.get<CusaPayment[]>('/api/cusa/payments', { params: filters as Record<string, string>, signal }),
  })
}

export function useRecordCusaPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { billId: string; amount: number; paymentDate: string; paymentMethod: string; referenceNo?: string }) =>
      api.post<CusaPayment>('/api/cusa/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.bills.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.cusa.payments.lists() })
    },
  })
}

// Reports
export function useCusaDashboard() {
  return useQuery({
    queryKey: queryKeys.cusa.dashboard(),
    queryFn: ({ signal }) => api.get<{ totalBilled: number; collected: number; outstanding: number; overdue: number }>('/api/cusa/reports/dashboard', { signal }),
  })
}

export interface CusaOverdueBill {
  id: string
  billNo: string
  billingQuarter: number
  billingYear: number
  totalAmount: number
  amountPaid: number
  balance: number
  dueDate: string
  daysOverdue: number
  unit: CusaUnit
  tenant: { id: string; fullName: string }
}

export function useCusaOverdue() {
  return useQuery({
    queryKey: queryKeys.cusa.overdue(),
    queryFn: ({ signal }) => api.get<CusaOverdueBill[]>('/api/cusa/reports/overdue', { signal }),
  })
}
