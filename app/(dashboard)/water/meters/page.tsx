'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, XCircle } from 'lucide-react'
import { useMeters, useCreateMeter, useUpdateMeter, useDeleteMeter, useTenants } from '@/hooks/use-water'
import type { WaterMeter } from '@/hooks/use-water'

export default function MetersPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingMeter, setEditingMeter] = useState<WaterMeter | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  const { data: meters, isLoading } = useMeters()
  const { data: tenants } = useTenants({ status: 'ACTIVE' })
  const createMeter = useCreateMeter()
  const updateMeter = useUpdateMeter()
  const deleteMeter = useDeleteMeter()

  const [formData, setFormData] = useState({
    meterNo: '',
    tenantId: '',
    unitNo: '',
    location: '',
    status: 'ACTIVE',
    installationDate: '',
  })

  const resetForm = () => {
    setFormData({ meterNo: '', tenantId: '', unitNo: '', location: '', status: 'ACTIVE', installationDate: '' })
    setEditingMeter(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (meter: WaterMeter) => {
    setEditingMeter(meter)
    setFormData({
      meterNo: meter.meterNo,
      tenantId: meter.tenantId || '',
      unitNo: meter.unitNo || '',
      location: meter.location || '',
      status: meter.status,
      installationDate: meter.installationDate ? new Date(meter.installationDate).toISOString().split('T')[0] : '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.meterNo.trim()) {
      setError('Meter number is required')
      return
    }

    try {
      if (editingMeter) {
        await updateMeter.mutateAsync({ id: editingMeter.id, data: formData })
      } else {
        await createMeter.mutateAsync(formData)
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save meter')
    }
  }

  const handleDelete = async (id: string, meterNo: string) => {
    if (!confirm(`Delete meter "${meterNo}"? This cannot be undone if there are no readings.`)) return
    try {
      await deleteMeter.mutateAsync(id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete meter')
    }
  }

  const filteredMeters = meters?.filter((m) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      m.meterNo.toLowerCase().includes(term) ||
      (m.tenant?.fullName || '').toLowerCase().includes(term) ||
      (m.unitNo || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold dark:text-white">Water Meters</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Meter
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search by meter number, tenant, or unit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden dark:bg-gray-900 dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Meter No.</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Unit</th>
                <th className="text-left px-4 py-3 font-medium text-sm dark:text-gray-300">Location</th>
                <th className="text-center px-4 py-3 font-medium text-sm dark:text-gray-300">Status</th>
                <th className="text-right px-4 py-3 font-medium text-sm dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {(filteredMeters || []).map((meter) => (
                <tr key={meter.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-mono font-medium dark:text-white">{meter.meterNo}</td>
                  <td className="px-4 py-3 dark:text-gray-300">{meter.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{meter.unitNo || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{meter.location || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      meter.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      meter.status === 'DAMAGED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {meter.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(meter)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/30" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(meter.id, meter.meterNo)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/30" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredMeters || filteredMeters.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No meters found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl my-8 dark:bg-gray-900">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl dark:border-gray-700">
              <h2 className="text-xl font-bold">{editingMeter ? 'Edit Meter' : 'Add Meter'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Meter Number *</label>
                <input
                  type="text"
                  value={formData.meterNo}
                  onChange={(e) => setFormData({ ...formData, meterNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tenant</label>
                <select
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                >
                  <option value="">Unassigned</option>
                  {(tenants || []).map((t) => (
                    <option key={t.id} value={t.id}>{t.fullName} {t.unitNo ? `(${t.unitNo})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Unit No.</label>
                  <input
                    type="text"
                    value={formData.unitNo}
                    onChange={(e) => setFormData({ ...formData, unitNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="DAMAGED">Damaged</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Installation Date</label>
                <input
                  type="date"
                  value={formData.installationDate}
                  onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:text-white dark:border-gray-600"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingMeter ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
