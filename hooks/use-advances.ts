import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Advance {
  id: string
  employeeId: string
  amount: number
  date: string
  purpose?: string
  status: string
  repaymentTerms?: string
}

export interface AdvanceSummaryEntry {
  date: string
  description: string
  type: 'DEBIT' | 'CREDIT'
  amount: number
  runningBalance: number
  advanceId: string
}

export interface AdvanceSummary {
  employee: { id: string; fullName: string; employeeId: string }
  entries: AdvanceSummaryEntry[]
  summary: { totalDebits: number; totalCredits: number; currentBalance: number }
}

export function useAdvances(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.advances.list(filters),
    queryFn: ({ signal }) => api.get<Advance[]>('/api/advances', { params: filters, signal }),
  })
}

export function useAdvanceSummary(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.advances.summary(employeeId),
    queryFn: ({ signal }) => api.get<AdvanceSummary>(`/api/advances/summary?employeeId=${employeeId}`, { signal }),
    enabled: !!employeeId,
  })
}

export function useCreateAdvance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Advance>) =>
      api.post<Advance>('/api/advances', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advances.lists() })
    },
  })
}

export function useUpdateAdvance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Advance> }) =>
      api.patch<Advance>(`/api/advances/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.advances.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.advances.details() })
    },
  })
}
