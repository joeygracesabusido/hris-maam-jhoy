'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, XCircle } from 'lucide-react'
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant } from '@/hooks/use-water'
import type { Tenant } from '@/hooks/use-water'

export default function TenantsPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  const { data: tenants, isLoading } = useTenants(searchTerm ? { search: searchTerm } : undefined)
  const createTenant = useCreateTenant()
  const updateTenant = useUpdateTenant()
  const deleteTenant = useDeleteTenant()

  const [formData, setFormData] = useState({
    fullName: '',
    contactNumber: '',
    email: '',
    address: '',
    unitNo: '',
    status: 'ACTIVE',
  })

  const resetForm = () => {
    setFormData({ fullName: '', contactNumber: '', email: '', address: '', unitNo: '', status: 'ACTIVE' })
    setEditingTenant(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setFormData({
      fullName: tenant.fullName,
      contactNumber: tenant.contactNumber || '',
      email: tenant.email || '',
      address: tenant.address || '',
      unitNo: tenant.unitNo || '',
      status: tenant.status,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.fullName.trim()) {
      setError('Full name is required')
      return
    }

    try {
      if (editingTenant) {
        await updateTenant.mutateAsync({ id: editingTenant.id, data: formData })
      } else {
        await createTenant.mutateAsync(formData)
      }
      setShowModal(false)
      resetForm()
    } catch {
      setError('Failed to save tenant')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tenant "${name}"? This action cannot be undone.`)) return
    try {
      await deleteTenant.mutateAsync(id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete tenant')
    }
  }

  const filteredTenants = tenants?.filter((t) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      t.fullName.toLowerCase().includes(term) ||
      (t.unitNo || '').toLowerCase().includes(term) ||
      (t.contactNumber || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Tenant
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-sm">Name</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Unit No.</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Contact</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Meters</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(filteredTenants || []).map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{tenant.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{tenant.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{tenant.contactNumber || tenant.email || '—'}</td>
                  <td className="px-4 py-3 text-center">{tenant._count?.meters ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(tenant)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(tenant.id, tenant.fullName)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredTenants || filteredTenants.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No tenants found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">{editingTenant ? 'Edit Tenant' : 'Add Tenant'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Number</label>
                <input
                  type="text"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Unit No.</label>
                  <input
                    type="text"
                    value={formData.unitNo}
                    onChange={(e) => setFormData({ ...formData, unitNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingTenant ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
