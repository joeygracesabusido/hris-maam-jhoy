'use client'

import { useState } from 'react'
import { Plus, Pencil, XCircle, DollarSign, X } from 'lucide-react'
import { useCusaRates, useCreateCusaRate, useUpdateCusaRate } from '@/hooks/use-cusa'
import type { CusaRate, CusaRateTier } from '@/hooks/use-cusa'

export default function CusaRatesPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingRate, setEditingRate] = useState<CusaRate | null>(null)
  const [error, setError] = useState('')

  const { data: rates, isLoading } = useCusaRates()
  const createRate = useCreateCusaRate()
  const updateRate = useUpdateCusaRate()

  const [formData, setFormData] = useState({
    name: '',
    effectiveFrom: '',
    effectiveTo: '',
  })

  const [tiers, setTiers] = useState<{ fromArea: number | string; toArea?: number; pricePerSqm: number | string; sequence: number }[]>([
    { fromArea: '', toArea: undefined, pricePerSqm: '', sequence: 1 },
  ])

  const resetForm = () => {
    setFormData({ name: '', effectiveFrom: '', effectiveTo: '' })
    setTiers([{ fromArea: '', toArea: undefined, pricePerSqm: '', sequence: 1 }])
    setEditingRate(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (rate: CusaRate) => {
    setEditingRate(rate)
    setFormData({
      name: rate.name,
      effectiveFrom: new Date(rate.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: rate.effectiveTo ? new Date(rate.effectiveTo).toISOString().split('T')[0] : '',
    })
    setTiers(
      rate.tiers.map((tier) => ({
        fromArea: tier.fromArea,
        toArea: tier.toArea,
        pricePerSqm: tier.pricePerSqm,
        sequence: tier.sequence,
      }))
    )
    setShowModal(true)
  }

  const addTier = () => {
    setTiers([
      ...tiers,
      { fromArea: '', toArea: undefined, pricePerSqm: '', sequence: tiers.length + 1 },
    ])
  }

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: 'fromArea' | 'toArea' | 'pricePerSqm' | 'sequence', value: number | string | undefined) => {
    const updated = [...tiers]
    updated[index] = { ...updated[index], [field]: value }
    setTiers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Rate name is required')
      return
    }

    if (!formData.effectiveFrom) {
      setError('Effective From date is required')
      return
    }

    if (tiers.length === 0) {
      setError('At least one tier is required')
      return
    }

    // Validate tiers and convert to numbers
    const parsedTiers = tiers.map((tier, idx) => {
      const fromArea = typeof tier.fromArea === 'string' ? parseFloat(tier.fromArea) : tier.fromArea
      const pricePerSqm = typeof tier.pricePerSqm === 'string' ? parseFloat(tier.pricePerSqm) : tier.pricePerSqm
      const toArea = tier.toArea !== undefined ? (typeof tier.toArea === 'string' ? parseFloat(tier.toArea) : tier.toArea) : undefined

      if (isNaN(fromArea) || fromArea < 0) {
        throw new Error(`Tier ${idx + 1}: Invalid From Area`)
      }
      if (isNaN(pricePerSqm) || pricePerSqm < 0) {
        throw new Error(`Tier ${idx + 1}: Invalid Price per Sq.m.`)
      }
      if (toArea !== undefined && (isNaN(toArea) || toArea < fromArea)) {
        throw new Error(`Tier ${idx + 1}: To Area must be greater than or equal to From Area`)
      }

      return { fromArea, toArea, pricePerSqm, sequence: tier.sequence }
    })

    try {
      const payload = {
        name: formData.name,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || undefined,
        tiers: parsedTiers as Omit<CusaRateTier, 'id'>[],
      }

      if (editingRate) {
        await updateRate.mutateAsync({ id: editingRate.id, data: payload })
      } else {
        await createRate.mutateAsync(payload)
      }
      setShowModal(false)
      resetForm()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to save rate')
    }
  }

  const formatDate = (dateStr: string) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
    return `${months[month - 1]} ${day.toString().padStart(2, '0')}, ${year}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">CUSA Rate Setup</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Rate
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Name</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Effective From</th>
                <th className="text-left px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Effective To</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-center px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Tiers</th>
                <th className="text-right px-4 py-3 font-medium text-sm text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(rates || []).map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium dark:text-white">{rate.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(rate.effectiveFrom)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{rate.effectiveTo ? formatDate(rate.effectiveTo) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        rate.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {rate.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{rate.tiers.length}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(rate)}
                      className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(!rates || rates.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No rates found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-xl my-8">
            <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">{editingRate ? 'Edit Rate' : 'Add Rate'}</h2>
              <button
                onClick={() => {
                  setShowModal(false)
                  resetForm()
                }}
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Rate Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  placeholder="e.g., Standard CUSA Rate"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Effective From *</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Effective To</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium dark:text-gray-300">Tiers *</label>
                  <button
                    type="button"
                    onClick={addTier}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Plus className="w-3 h-3" /> Add Tier
                  </button>
                </div>

                <div className="space-y-3">
                  {tiers.map((tier, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="grid grid-cols-3 gap-2 flex-1">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From Area (sq.m.)</label>
                          <input
                            type="number"
                            value={tier.fromArea}
                            onChange={(e) => updateTier(index, 'fromArea', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            min="0"
                            step="0.01"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To Area (sq.m.)</label>
                          <input
                            type="number"
                            value={tier.toArea ?? ''}
                            onChange={(e) =>
                              updateTier(index, 'toArea', e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            min="0"
                            step="0.01"
                            placeholder="No limit"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Price per Sq.m.</label>
                          <input
                            type="number"
                            value={tier.pricePerSqm}
                            onChange={(e) => updateTier(index, 'pricePerSqm', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTier(index)}
                        disabled={tiers.length <= 1}
                        className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded disabled:opacity-30 disabled:cursor-not-allowed mt-5"
                        title="Remove Tier"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
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
