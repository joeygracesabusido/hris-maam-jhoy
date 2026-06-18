import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Holiday {
  id: string
  name: string
  date: string
  type: 'REGULAR' | 'SPECIAL'
}

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: queryKeys.holidays.list(year),
    queryFn: ({ signal }) => api.get<Holiday[]>(`/api/holidays${year ? `?year=${year}` : ''}`, { signal }),
  })
}

export function useCreateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Holiday>) =>
      api.post<Holiday>('/api/holidays', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holidays.lists() })
    },
  })
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Holiday> }) =>
      api.patch<Holiday>(`/api/holidays/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holidays.lists() })
    },
  })
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.holidays.lists() })
    },
  })
}
