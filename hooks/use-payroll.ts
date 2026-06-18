import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface PayrollRecord {
  id: string
  employeeId: string
  periodStart: string
  periodEnd: string
  grossPay: number
  deductions: number
  netPay: number
  status: string
}

export function usePayrollRecords(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.payroll.list(filters),
    queryFn: ({ signal }) => api.get<PayrollRecord[]>('/api/payroll', { params: filters, signal }),
  })
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number }) =>
      api.post<PayrollRecord[]>('/api/payroll', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() })
    },
  })
}

export function useComputePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { employeeIds: string[]; month: number; year: number }) =>
      api.post('/api/payroll/compute', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.lists() })
    },
  })
}
