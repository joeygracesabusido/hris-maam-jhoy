import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface LeaveRequest {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  status: string
  reason?: string
  createdAt: string
}

export interface LeaveBalance {
  sickLeave: number
  vacationLeave: number
  emergencyLeave: number
  bereavementLeave: number
  maternityLeave: number
  paternityLeave: number
}

export function useLeaves(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.leaves.list(filters),
    queryFn: ({ signal }) => api.get<LeaveRequest[]>('/api/leaves', { params: filters, signal }),
  })
}

export function useLeaveBalance(employeeId?: string) {
  return useQuery({
    queryKey: [...queryKeys.leaves.all, 'balance', employeeId],
    queryFn: ({ signal }) => api.get<LeaveBalance>(`/api/leaves/balance${employeeId ? `?employeeId=${employeeId}` : ''}`, { signal }),
    enabled: !!employeeId,
  })
}

export function useSubmitLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<LeaveRequest>) =>
      api.post<LeaveRequest>('/api/leaves', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaves.lists() })
    },
  })
}

export function useApproveLeave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<LeaveRequest>(`/api/leaves/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaves.lists() })
    },
  })
}
