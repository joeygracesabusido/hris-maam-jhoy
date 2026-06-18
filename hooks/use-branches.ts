import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Branch {
  id: string
  name: string
  code?: string
  address?: string
  contactPerson?: string
  contactPhone?: string
  contactEmail?: string
  isActive: boolean
}

export function useBranches() {
  return useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: ({ signal }) => api.get<Branch[]>('/api/branches', { signal }),
  })
}

export function useCreateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Branch>) =>
      api.post<Branch>('/api/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.lists() })
    },
  })
}

export function useUpdateBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Branch> }) =>
      api.patch<Branch>(`/api/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.lists() })
    },
  })
}

export function useDeleteBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.branches.lists() })
    },
  })
}
