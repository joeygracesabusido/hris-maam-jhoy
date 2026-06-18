import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

export interface Employee {
  id: string
  employeeNumber: number
  fullName: string
  email: string
  employeeId: string
  position: string
  department: string
  payType: string
  basicSalary: number
  dailyRate: number
  payrollFrequency: string
  hireDate: string
  isActive: boolean
  employeeStatus: string
  regularizationDate?: string
  managerId?: string
  tin: string
  sssNo: string
  philhealthNo: string
  pagibigNo: string
  bankName: string
  bankAccountNo: string
}

export function useEmployees(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.employees.list(filters),
    queryFn: ({ signal }) => api.get<Employee[]>('/api/employees', { params: filters, signal }),
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id),
    queryFn: ({ signal }) => api.get<Employee>(`/api/employees/${id}`, { signal }),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Employee>) =>
      api.post<Employee>('/api/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Employee> }) =>
      api.patch<Employee>(`/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.details() })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() })
    },
  })
}
