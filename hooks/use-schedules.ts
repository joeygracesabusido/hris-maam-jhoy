import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Schedule {
  id: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
}

export function useSchedules(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.schedules.list(filters),
    queryFn: ({ signal }) => api.get<Schedule[]>('/api/schedules', { params: filters, signal }),
  })
}
