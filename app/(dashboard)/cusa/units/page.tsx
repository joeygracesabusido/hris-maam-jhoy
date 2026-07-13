'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, XCircle, Home } from 'lucide-react'
import { useCusaUnits, useCreateCusaUnit, useUpdateCusaUnit, useDeleteCusaUnit } from '@/hooks/use-cusa'
import type { CusaUnit } from '@/hooks/use-cusa'

const STATUS_BADGE: Record<string, string> = {
  OCCUPIED: 'bg-green-100 text-green-700',
  VACANT: 'bg-gray-100 text-gray-600',
  UNDER_RENOVATION: 'bg-yellow-100 text-yellow-700',
}

export default function CusaUnitsPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingUnit, setEditingUnit] = useState<CusaUnit | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')

  const filters: Record<string, string> = {}
  if (searchTerm) filters.search = searchTerm
  if (statusFilter) filters.status = statusFilter

  const { data: units, isLoading } = useCusaUnits(Object.keys(filters).length > 0 ? filters : undefined)
  const createUnit = useCreateCusaUnit()
  const updateUnit = useUpdateCusaUnit()
  const deleteUnit = useDeleteCusaUnit()

  const [formData, setFormData] = useState({
    tenantId: '',
    unitNo: '',
    floor: 1,
    zone: '',
    areaSqm: 0,
    status: 'VACANT',
    leaseStart: '',
    leaseEnd: '',
  })

  const resetForm = () => {
    setFormData({
      tenantId: '',
      unitNo: '',
      floor: 1,
      zone: '',
      areaSqm: 0,
      status: 'VACANT',
      leaseStart: '',
      leaseEnd: '',
    })
    setEditingUnit(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (unit: CusaUnit) => {
    setEditingUnit(unit)
    setFormData({
      tenantId: unit.tenantId || '',
      unitNo: unit.unitNo,
      floor: unit.floor,
      zone: unit.zone || '',
      areaSqm: unit.areaSqm,
      status: unit.status,
      leaseStart: unit.leaseStart ? new Date(unit.leaseStart).toISOString().split('T')[0] : '',
      leaseEnd: unit.leaseEnd ? new Date(unit.leaseEnd).toISOString().split('T')[0] : '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.unitNo.trim()) {
      setError('Unit number is required')
      return
    }

    if (formData.areaSqm <= 0) {
      setError('Area must be greater than 0')
      return
    }

    try {
      if (editingUnit) {
        await updateUnit.mutateAsync({ id: editingUnit.id, data: formData })
      } else {
        await createUnit.mutateAsync(formData)
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save unit')
    }
  }

  const handleDelete = async (id: string, unitNo: string) => {
    if (!confirm(`Delete unit "${unitNo}"? This action cannot be undone.`)) return
    try {
      await deleteUnit.mutateAsync(id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete unit')
    }
  }

  const filteredUnits = units?.filter((u) => {
    if (!searchTerm && !statusFilter) return true
    let matches = true
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      matches = matches && (
        u.unitNo.toLowerCase().includes(term) ||
        (u.tenant?.fullName || '').toLowerCase().includes(term) ||
        (u.zone || '').toLowerCase().includes(term)
      )
    }
    if (statusFilter) {
      matches = matches && u.status === statusFilter
    }
    return matches
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Home className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">CUSA Units</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Unit
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white"
        >
          <option value="">All Statuses</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="VACANT">Vacant</option>
          <option value="UNDER_RENOVATION">Under Renovation</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-sm">Unit No</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Floor</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Zone</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Area (sq.m.)</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Tenant</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Status</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Lease Start</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Lease End</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(filteredUnits || []).map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{unit.unitNo}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.floor}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.zone || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{unit.areaSqm}</td>
                  <td className="px-4 py-3 text-gray-600">{unit.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_BADGE[unit.status] || 'bg-gray-100 text-gray-600'
                    }`}>
                      {unit.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {unit.leaseStart ? format(new Date(unit.leaseStart), 'MMM dd, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {unit.leaseEnd ? format(new Date(unit.leaseEnd), 'MMM dd, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(unit)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(unit.id, unit.unitNo)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredUnits || filteredUnits.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No units found</td>
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
              <h2 className="text-xl font-bold">{editingUnit ? 'Edit Unit' : 'Add Unit'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Unit No *</label>
                <input
                  type="text"
                  value={formData.unitNo}
                  onChange={(e) => setFormData({ ...formData, unitNo: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Floor *</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Area (sq.m.) *</label>
                  <input
                    type="number"
                    value={formData.areaSqm}
                    onChange={(e) => setFormData({ ...formData, areaSqm: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Zone</label>
                <input
                  type="text"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tenant ID</label>
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="OCCUPIED">Occupied</option>
                  <option value="VACANT">Vacant</option>
                  <option value="UNDER_RENOVATION">Under Renovation</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lease Start</label>
                  <input
                    type="date"
                    value={formData.leaseStart}
                    onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Lease End</label>
                  <input
                    type="date"
                    value={formData.leaseEnd}
                    onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingUnit ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function format(date: Date, formatStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${month} ${day.toString().padStart(2, '0')}, ${year}`
}