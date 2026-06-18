import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface DashboardStats {
  totalEmployees: number
  presentToday: number
  onLeaveToday: number
  absentPerDepartment: {
    name: string
    absent: number
    total: number
  }[]
  personalStats?: {
    isPresent: boolean
    isOnLeave: boolean
    employeeName: string | undefined
    department: string | undefined
  }
}

export function useDashboardStats(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(params),
    queryFn: ({ signal }) => api.get<DashboardStats>('/api/dashboard/stats', { params, signal }),
  })
}
