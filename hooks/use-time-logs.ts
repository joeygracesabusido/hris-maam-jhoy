import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface TimeLog {
  id: string
  employeeId: string
  date: string
  clockIn: string | null
  clockOut: string | null
  workHours: number
  shift: { id: string; name: string; startTime: string; endTime: string } | null
  employee: { fullName: string; employeeId: string }
}

export interface OfficeLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius: number
  isActive: boolean
}

export function useTimeLogs(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.timeLogs.list(filters),
    queryFn: ({ signal }) => api.get<TimeLog[]>('/api/time-logs', { params: filters, signal }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })
}

/**
 * Fetch the current employee's time log for today (Manila day).
 * Used to reliably determine whether Clock In / Clock Out should be enabled,
 * since deriving "today" from the time-logs list via client-side date string
 * comparison is fragile (timezone edge cases, stale list during refetch, etc.).
 */
export function useTodayTimeLog(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: [...queryKeys.timeLogs.all, 'today', employeeId ?? ''] as const,
    queryFn: ({ signal }) => {
      const params: Record<string, string> = {}
      if (employeeId) params.employeeId = employeeId
      return api.get<{ todayLog: TimeLog | null }>(`/api/time-logs/today`, {
        params,
        signal,
      })
    },
    enabled: !!employeeId,
    staleTime: 5_000,
    refetchInterval: 15_000,
  })
}

export function useOfficeLocations() {
  return useQuery({
    queryKey: queryKeys.officeLocations.list(),
    queryFn: ({ signal }) => api.get<OfficeLocation[]>('/api/office-location', { signal }),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useClockIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { employeeId: string; date: string; clockIn: string; location?: { lat: number; lon: number } }) =>
      api.post<TimeLog>('/api/time-logs', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() })
      queryClient.setQueryData(
        [...queryKeys.timeLogs.all, 'today', variables.employeeId],
        {
          todayLog: {
            id: `optimistic-${Date.now()}`,
            employeeId: variables.employeeId,
            date: variables.date,
            clockIn: variables.clockIn,
            clockOut: null,
            workHours: 0,
            shift: null,
            employee: { fullName: '', employeeId: '' },
          },
        }
      )
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { employeeId: string; date: string; clockOut: string; location?: { lat: number; lon: number } }) =>
      api.post<TimeLog>('/api/time-logs', data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() })
      queryClient.setQueryData(
        [...queryKeys.timeLogs.all, 'today', variables.employeeId],
        (old: { todayLog: TimeLog | null } | undefined) => ({
          todayLog: old?.todayLog
            ? { ...old.todayLog, clockOut: variables.clockOut }
            : {
                id: `optimistic-${Date.now()}`,
                employeeId: variables.employeeId,
                date: variables.date,
                clockIn: null,
                clockOut: variables.clockOut,
                workHours: 0,
                shift: null,
                employee: { fullName: '', employeeId: '' },
              },
        })
      )
    },
  })
}

export function useEmployeeFaceDescriptor(employeeId: string) {
  return useQuery({
    queryKey: ['employees', 'face-descriptor', employeeId],
    queryFn: ({ signal }) => api.get<{ faceDescriptor: number[] }>(`/api/employees/${employeeId}/face-descriptor`, { signal }),
    enabled: !!employeeId,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
