import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Tenant {
  id: string
  fullName: string
  contactNumber?: string
  email?: string
  address?: string
  unitNo?: string
  status: string
  branchId?: string
  createdAt: string
  updatedAt: string
  _count?: { meters: number; bills: number }
}

export interface WaterMeter {
  id: string
  meterNo: string
  tenantId?: string
  tenant?: Tenant
  unitNo?: string
  location?: string
  status: string
  installationDate?: string
  branchId?: string
}

export interface WaterMeterReading {
  id: string
  meterId: string
  meter?: WaterMeter
  readingDate: string
  previousReading: number
  currentReading: number
  consumption: number
  source: string
  isEstimated: boolean
  notes?: string
}

export interface WaterRateTier {
  id?: string
  rateId?: string
  fromUnit: number
  toUnit: number | null
  pricePerUnit: number
  sequence: number
}

export interface WaterRate {
  id: string
  name: string
  rateType: string
  effectiveFrom: string
  effectiveTo?: string
  isActive: boolean
  branchId?: string
  tiers: WaterRateTier[]
}

export interface TierBreakdown {
  label: string
  units: number
  rate: number
  amount: number
}

export interface WaterBill {
  id: string
  billNo: string
  tenantId: string
  tenant?: Tenant
  meterId: string
  meter?: WaterMeter
  readingId?: string
  reading?: WaterMeterReading
  billingMonth: number
  billingYear: number
  previousReading: number
  currentReading: number
  consumption: number
  totalAmount: number
  amountPaid: number
  balance: number
  dueDate: string
  status: string
  journalEntryId?: string
  branchId?: string
  payments?: WaterPayment[]
  rate?: WaterRate | null
  tierBreakdown?: TierBreakdown[] | null
}

export interface WaterPayment {
  id: string
  billId: string
  bill?: WaterBill
  amount: number
  paymentDate: string
  paymentMethod: string
  referenceNo?: string
  notes?: string
  journalEntryId?: string
}

// Tenants
export function useTenants(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.tenants.list(filters),
    queryFn: ({ signal }) => api.get<Tenant[]>('/api/water/tenants', { params: filters, signal }),
  })
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: queryKeys.water.tenants.detail(id),
    queryFn: ({ signal }) => api.get<Tenant>(`/api/water/tenants/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Tenant>) => api.post<Tenant>('/api/water/tenants', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.tenants.lists() })
    },
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      api.patch<Tenant>(`/api/water/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.tenants.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.tenants.details() })
    },
  })
}

export function useDeleteTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/tenants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.tenants.lists() })
    },
  })
}

// Meters
export function useMeters(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.meters.list(filters),
    queryFn: ({ signal }) => api.get<WaterMeter[]>('/api/water/meters', { params: filters, signal }),
  })
}

export function useMeter(id: string) {
  return useQuery({
    queryKey: queryKeys.water.meters.detail(id),
    queryFn: ({ signal }) => api.get<WaterMeter>(`/api/water/meters/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateMeter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WaterMeter>) => api.post<WaterMeter>('/api/water/meters', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.meters.lists() })
    },
  })
}

export function useUpdateMeter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterMeter> }) =>
      api.patch<WaterMeter>(`/api/water/meters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.meters.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.meters.details() })
    },
  })
}

export function useDeleteMeter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/meters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.meters.lists() })
    },
  })
}

// Readings
export function useReadings(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.readings.list(filters),
    queryFn: ({ signal }) => api.get<WaterMeterReading[]>('/api/water/readings', { params: filters, signal }),
  })
}

export function useCreateReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WaterMeterReading>) =>
      api.post<WaterMeterReading>('/api/water/readings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.readings.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.meters.lists() })
    },
  })
}

export function useUpdateReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterMeterReading> }) =>
      api.patch<WaterMeterReading>(`/api/water/readings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.readings.lists() })
    },
  })
}

export function useDeleteReading() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/readings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.readings.lists() })
    },
  })
}

// Rates
export function useRates(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.rates.list(filters),
    queryFn: ({ signal }) => api.get<WaterRate[]>('/api/water/rates', { params: filters, signal }),
  })
}

export function useRate(id: string) {
  return useQuery({
    queryKey: queryKeys.water.rates.detail(id),
    queryFn: ({ signal }) => api.get<WaterRate>(`/api/water/rates/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WaterRate>) => api.post<WaterRate>('/api/water/rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.rates.lists() })
    },
  })
}

export function useUpdateRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterRate> }) =>
      api.patch<WaterRate>(`/api/water/rates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.rates.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.rates.details() })
    },
  })
}

export function useDeleteRate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.rates.lists() })
    },
  })
}

// Bills
export function useBills(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.bills.list(filters),
    queryFn: ({ signal }) => api.get<WaterBill[]>('/api/water/bills', { params: filters, signal }),
  })
}

export function useBill(id: string) {
  return useQuery({
    queryKey: queryKeys.water.bills.detail(id),
    queryFn: ({ signal }) => api.get<WaterBill>(`/api/water/bills/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useGenerateBills() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      billingMonth: number
      billingYear: number
      rateId: string
      dueDate: string
      meterIds?: string[]
      branchId?: string
    }) => api.post<WaterBill[] | { message: string }>('/api/water/bills', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.tenants.lists() })
    },
  })
}

export function useUpdateBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WaterBill> }) =>
      api.patch<WaterBill>(`/api/water/bills/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.details() })
    },
  })
}

export function useDeleteBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.lists() })
    },
  })
}

// Payments
export function usePayments(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.water.payments.list(filters),
    queryFn: ({ signal }) => api.get<WaterPayment[]>('/api/water/payments', { params: filters, signal }),
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<WaterPayment>) =>
      api.post<WaterPayment>('/api/water/payments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.payments.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.details() })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/water/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.water.payments.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.water.bills.lists() })
    },
  })
}
