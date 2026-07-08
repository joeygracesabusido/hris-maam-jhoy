'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, XCircle, PlusCircle, MinusCircle } from 'lucide-react'
import { useRates, useCreateRate, useUpdateRate, useDeleteRate } from '@/hooks/use-water'
import type { WaterRate, WaterRateTier } from '@/hooks/use-water'
import { format } from 'date-fns'

export default function RatesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingRate, setEditingRate] = useState<WaterRate | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')

  const { data: rates, isLoading } = useRates()
  const createRate = useCreateRate()
  const updateRate = useUpdateRate()
  const deleteRate = useDeleteRate()

  const [formData, setFormData] = useState({
    name: '',
    rateType: 'TIERED',
    effectiveFrom: '',
    effectiveTo: '',
    isActive: true,
    tiers: [{ fromUnit: 0, toUnit: 10, pricePerUnit: 15, sequence: 1 }] as Partial<WaterRateTier>[],
  })

  const resetForm = () => {
    setFormData({
      name: '',
      rateType: 'TIERED',
      effectiveFrom: '',
      effectiveTo: '',
      isActive: true,
      tiers: [{ fromUnit: 0, toUnit: 10, pricePerUnit: 15, sequence: 1 }],
    })
    setEditingRate(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (rate: WaterRate) => {
    setEditingRate(rate)
    setFormData({
      name: rate.name,
      rateType: rate.rateType,
      effectiveFrom: new Date(rate.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: rate.effectiveTo ? new Date(rate.effectiveTo).toISOString().split('T')[0] : '',
      isActive: rate.isActive,
      tiers: rate.tiers.map((t) => ({
        fromUnit: t.fromUnit,
        toUnit: t.toUnit,
        pricePerUnit: t.pricePerUnit,
        sequence: t.sequence,
      })),
    })
    setShowModal(true)
  }

  const addTier = () => {
    const lastSeq = formData.tiers.reduce((max, t) => Math.max(max, t.sequence || 0), 0)
    const lastToUnit = formData.tiers[formData.tiers.length - 1]?.toUnit ?? 0
    setFormData({
      ...formData,
      tiers: [
        ...formData.tiers,
        { fromUnit: lastToUnit, toUnit: lastToUnit + 20, pricePerUnit: 0, sequence: lastSeq + 1 },
      ],
    })
  }

  const removeTier = (index: number) => {
    if (formData.tiers.length <= 1) return
    const tiers = formData.tiers.filter((_, i) => i !== index)
    setFormData({ ...formData, tiers: tiers.map((t, i) => ({ ...t, sequence: i + 1 })) })
  }

  const updateTier = (index: number, field: string, value: string | number) => {
    const tiers = [...formData.tiers]
    tiers[index] = { ...tiers[index], [field]: value }
    setFormData({ ...formData, tiers })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || !formData.effectiveFrom) {
      setError('Name and effective date are required')
      return
    }

    if (formData.rateType === 'TIERED') {
      const invalidTier = formData.tiers.find((t) => !t.pricePerUnit || t.pricePerUnit <= 0)
      if (invalidTier) {
        setError('All tiers must have a price greater than 0')
        return
      }
    }

    try {
      const data = {
        name: formData.name,
        rateType: formData.rateType,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null,
        isActive: formData.isActive,
        tiers: formData.rateType === 'TIERED' ? formData.tiers.map((t, i) => ({
          fromUnit: t.fromUnit || 0,
          toUnit: t.toUnit ?? null,
          pricePerUnit: t.pricePerUnit || 0,
          sequence: i + 1,
        })) : [{ fromUnit: 0, toUnit: null, pricePerUnit: formData.tiers[0]?.pricePerUnit || 0, sequence: 1 }],
      }

      if (editingRate) {
        await updateRate.mutateAsync({ id: editingRate.id, data })
      } else {
        await createRate.mutateAsync(data)
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save rate')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate rate "${name}"?`)) return
    try {
      await deleteRate.mutateAsync(id)
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || 'Failed to deactivate rate')
    }
  }

  const filteredRates = rates?.filter((r) => {
    if (!searchTerm) return true
    return r.name.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rate Setup</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Rate
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search rates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {(filteredRates || []).map((rate) => (
            <div key={rate.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg">{rate.name}</h3>
                  <p className="text-sm text-gray-500">
                    {rate.rateType} • Effective {format(new Date(rate.effectiveFrom), 'MMM dd, yyyy')}
                    {rate.effectiveTo ? ` to ${format(new Date(rate.effectiveTo), 'MMM dd, yyyy')}` : ' (ongoing)'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    rate.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {rate.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => openEdit(rate)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(rate.id, rate.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Deactivate">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {rate.rateType === 'TIERED' && rate.tiers.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <table className="w-full max-w-md">
                    <thead>
                      <tr className="text-xs text-gray-500">
                        <th className="text-left py-1">From</th>
                        <th className="text-left py-1">To</th>
                        <th className="text-right py-1">Rate/m³</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rate.tiers.map((tier) => (
                        <tr key={tier.id || tier.sequence}>
                          <td className="py-1">{tier.fromUnit} m³</td>
                          <td className="py-1">{tier.toUnit ? `${tier.toUnit} m³` : 'Above'}</td>
                          <td className="py-1 text-right font-mono">₱{tier.pricePerUnit.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {rate.rateType === 'FLAT' && rate.tiers[0] && (
                <div className="mt-4 border-t pt-4">
                  <p className="font-mono text-lg font-bold">₱{rate.tiers[0].pricePerUnit.toFixed(2)} / month</p>
                </div>
              )}
            </div>
          ))}
          {(!filteredRates || filteredRates.length === 0) && (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">No rates found</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl my-8">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">{editingRate ? 'Edit Rate' : 'Add Rate'}</h2>
              <button onClick={() => { setShowModal(false); resetForm() }}><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium mb-1">Rate Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Residential Tiered Rate 2026"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Rate Type</label>
                  <select
                    value={formData.rateType}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="TIERED">Tiered</option>
                    <option value="FLAT">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Active</label>
                  <select
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Effective To (optional)</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {formData.rateType === 'TIERED' ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Tiers</label>
                    <button type="button" onClick={addTier} className="text-blue-600 hover:text-blue-800">
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>
                  {formData.tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="number"
                        placeholder="From"
                        value={tier.fromUnit}
                        onChange={(e) => updateTier(index, 'fromUnit', parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 border rounded text-sm"
                      />
                      <span className="text-gray-400">—</span>
                      <input
                        type="number"
                        placeholder="To"
                        value={tier.toUnit ?? ''}
                        onChange={(e) => updateTier(index, 'toUnit', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-20 px-2 py-1.5 border rounded text-sm"
                      />
                      <span className="text-gray-400">m³ @ ₱</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        value={tier.pricePerUnit}
                        onChange={(e) => updateTier(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 border rounded text-sm"
                      />
                      {formData.tiers.length > 1 && (
                        <button type="button" onClick={() => removeTier(index)} className="text-red-500 hover:text-red-700">
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Flat Rate (₱ per month)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tiers[0]?.pricePerUnit || ''}
                    onChange={(e) => {
                      const tiers = [{ fromUnit: 0, toUnit: null, pricePerUnit: parseFloat(e.target.value) || 0, sequence: 1 }]
                      setFormData({ ...formData, tiers })
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 500.00"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {editingRate ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
