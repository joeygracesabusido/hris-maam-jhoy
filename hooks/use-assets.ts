import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Asset {
  id: string
  name: string
  categoryId?: string
  purchaseDate?: string
  purchaseCost?: number
  currentValue?: number
  status?: string
  assignedTo?: string
}

export interface AssetCategory {
  id: string
  name: string
  description?: string
}

export interface AssetTransaction {
  id: string
  assetId: string
  type: string
  date: string
  amount?: number
  description?: string
}

// --- Assets ---
export function useAssets(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.assets.list(params),
    queryFn: ({ signal }) => api.get<Asset[]>('/api/assets', { params, signal }),
  })
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: queryKeys.assets.detail(id),
    queryFn: ({ signal }) => api.get<Asset>(`/api/assets/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Asset>) =>
      api.post<Asset>('/api/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.lists() })
    },
  })
}

export function useUpdateAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) =>
      api.patch<Asset>(`/api/assets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.details() })
    },
  })
}

export function useDeleteAsset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/assets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.lists() })
    },
  })
}

// --- Asset Categories ---
export function useAssetCategories() {
  return useQuery({
    queryKey: queryKeys.assets.categories.list(),
    queryFn: ({ signal }) => api.get<AssetCategory[]>('/api/assets/categories', { signal }),
  })
}

export function useCreateAssetCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AssetCategory>) =>
      api.post<AssetCategory>('/api/assets/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assets.categories.lists() })
    },
  })
}

// --- Asset Transactions ---
export function useAssetTransactions(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.assets.transactions.list(params),
    queryFn: ({ signal }) => api.get<AssetTransaction[]>('/api/assets/transactions', { params, signal }),
  })
}
