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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() })
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { employeeId: string; date: string; clockOut: string; location?: { lat: number; lon: number } }) =>
      api.patch<TimeLog>('/api/time-logs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() })
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
