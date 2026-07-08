'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, XCircle, AlertTriangle } from 'lucide-react'
import { useReadings, useCreateReading, useUpdateReading, useDeleteReading, useMeters } from '@/hooks/use-water'
import type { WaterMeterReading } from '@/hooks/use-water'
import { format } from 'date-fns'

export default function ReadingsPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingReading, setEditingReading] = useState<WaterMeterReading | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [showSpikeWarning, setShowSpikeWarning] = useState(false)

  const { data: readings, isLoading } = useReadings()
  const { data: meters } = useMeters({ status: 'ACTIVE' })
  const createReading = useCreateReading()
  const updateReading = useUpdateReading()
  const deleteReading = useDeleteReading()

  const [formData, setFormData] = useState({
    meterId: '',
    readingDate: new Date().toISOString().split('T')[0],
    currentReading: '',
    previousReading: '0',
    notes: '',
    isEstimated: false,
  })

  const resetForm = () => {
    setFormData({
      meterId: '',
      readingDate: new Date().toISOString().split('T')[0],
      currentReading: '',
      previousReading: '0',
      notes: '',
      isEstimated: false,
    })
    setEditingReading(null)
    setError('')
    setShowSpikeWarning(false)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const handleMeterChange = async (meterId: string) => {
    setFormData({ ...formData, meterId, previousReading: '0' })

    if (!meterId) return

    try {
      const res = await fetch(`/api/water/meters/${meterId}`)
      const meter = await res.json()
      if (meter.readings && meter.readings.length > 0) {
        const lastReading = meter.readings[0]
        setFormData((prev) => ({ ...prev, meterId, previousReading: String(lastReading.currentReading) }))
      }
    } catch {
      // Silently fail
    }
  }

  const openEdit = (reading: WaterMeterReading) => {
    setEditingReading(reading)
    setFormData({
      meterId: reading.meterId,
      readingDate: new Date(reading.readingDate).toISOString().split('T')[0],
      currentReading: String(reading.currentReading),
      previousReading: String(reading.previousReading),
      notes: reading.notes || '',
      isEstimated: reading.isEstimated,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.meterId || !formData.readingDate || !formData.currentReading) {
      setError('Meter, date, and current reading are required')
      return
    }

    const currentReading = parseFloat(formData.currentReading)
    const previousReading = parseFloat(formData.previousReading)

    if (isNaN(currentReading)) {
      setError('Invalid current reading')
      return
    }

    if (currentReading < previousReading) {
      setError(`Current reading cannot be less than previous reading (${previousReading})`)
      return
    }

    const consumption = currentReading - previousReading
    const avgReading = previousReading > 0 ? consumption / previousReading : 0
    if (previousReading > 0 && avgReading > 2 && !showSpikeWarning) {
      setShowSpikeWarning(true)
      return
    }

    try {
      const data = {
        meterId: formData.meterId,
        readingDate: formData.readingDate,
        currentReading,
        notes: formData.notes || undefined,
        isEstimated: formData.isEstimated,
      }

      if (editingReading) {
        await updateReading.mutateAsync({ id: editingReading.id, data })
      } else {
        await createReading.mutateAsync(data)
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save reading')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reading?')) return
    try {
      await deleteReading.mutateAsync(id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to delete reading')
    }
  }

  const filteredReadings = readings?.filter((r) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (r.meter?.meterNo || '').toLowerCase().includes(term) ||
      (r.meter?.tenant?.fullName || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meter Readings</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Reading
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by meter or tenant..."
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
                <th className="text-left px-4 py-3 font-medium text-sm">Date</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Meter No.</th>
                <th className="text-left px-4 py-3 font-medium text-sm">Tenant</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Previous</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Current</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Consumption</th>
                <th className="text-center px-4 py-3 font-medium text-sm">Source</th>
                <th className="text-right px-4 py-3 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(filteredReadings || []).map((reading) => (
                <tr key={reading.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{format(new Date(reading.readingDate), 'MMM dd, yyyy')}</td>
                  <td className="px-4 py-3 font-mono">{reading.meter?.meterNo || '—'}</td>
                  <td className="px-4 py-3">{reading.meter?.tenant?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-right">{reading.previousReading.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-medium">{reading.currentReading.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{reading.consumption.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      reading.source === 'MANUAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {reading.source}
                    </span>
                    {reading.isEstimated && (
                      <span className="ml-1 inline-flex items-center text-yellow-600" title="Estimated">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(reading)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(reading.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!filteredReadings || filteredReadings.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No readings found</td>
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
              <h2 className="text-xl font-bold">{editingReading ? 'Edit Reading' : 'Add Reading'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              {showSpikeWarning && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                  <strong>Spike detected!</strong> This reading is significantly higher than the previous one. Click Save again to confirm.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Meter *</label>
                <select
                  value={formData.meterId}
                  onChange={(e) => handleMeterChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select meter...</option>
                  {(meters || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.meterNo} — {m.tenant?.fullName || 'Unassigned'} {m.unitNo ? `(${m.unitNo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reading Date *</label>
                <input
                  type="date"
                  value={formData.readingDate}
                  onChange={(e) => setFormData({ ...formData, readingDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Previous Reading</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.previousReading}
                    onChange={(e) => setFormData({ ...formData, previousReading: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Current Reading *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.currentReading}
                    onChange={(e) => setFormData({ ...formData, currentReading: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Consumption (auto-computed)</label>
                <input
                  type="text"
                  value={formData.currentReading && formData.previousReading
                    ? (parseFloat(formData.currentReading) - parseFloat(formData.previousReading)).toFixed(1)
                    : '0.0'}
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  readOnly
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEstimated"
                  checked={formData.isEstimated}
                  onChange={(e) => setFormData({ ...formData, isEstimated: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isEstimated" className="text-sm">Estimated reading</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingReading ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
