import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface OvertimeRequest {
  id: string
  employeeId: string
  date: string
  hours: number
  reason?: string
  status: string
}

export function useOvertime(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.overtime.list(filters),
    queryFn: ({ signal }) => api.get<OvertimeRequest[]>('/api/overtime', { params: filters, signal }),
  })
}

export function useSubmitOvertime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<OvertimeRequest>) =>
      api.post<OvertimeRequest>('/api/overtime', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.lists() })
    },
  })
}

export function useApproveOvertime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<OvertimeRequest>(`/api/overtime/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.lists() })
    },
  })
}
