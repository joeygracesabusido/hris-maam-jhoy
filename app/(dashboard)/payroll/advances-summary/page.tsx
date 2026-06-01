'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ArrowLeft, DollarSign } from 'lucide-react'
import { format } from 'date-fns/format'
import Link from 'next/link'

interface Employee {
  id: string
  fullName: string
  employeeId: string
}

interface LedgerEntry {
  id: string
  date: string
  description: string
  type: 'DEBIT' | 'CREDIT'
  amount: number
  runningBalance: number
  advanceId: string
  reference?: string
}

interface SummaryData {
  employee: Employee
  entries: LedgerEntry[]
  summary: {
    totalDebits: number
    totalCredits: number
    currentBalance: number
  }
}

export default function AdvancesSummaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [error, setError] = useState('')

  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter employees when searchText changes
  useEffect(() => {
    if (searchText.trim()) {
      setFilteredEmployees(
        employees.filter((emp) =>
          emp.fullName.toLowerCase().includes(searchText.toLowerCase())
        )
      )
    } else {
      setFilteredEmployees(employees)
    }
  }, [searchText, employees])

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch employees')
      const data: Employee[] = await res.json()
      setEmployees(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchSummary = useCallback(async (employeeId: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/advances/summary?employeeId=${employeeId}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().then((d) => d as { error?: string })
        throw new Error(data.error || 'Failed to fetch summary')
      }
      const data: SummaryData = await res.json()
      setSummaryData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSummaryData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp)
    setSearchText(emp.fullName)
    setShowDropdown(false)
    fetchSummary(emp.id)
  }

  const handleClearSelection = () => {
    setSelectedEmployee(null)
    setSearchText('')
    setSummaryData(null)
    setError('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/payroll"
          className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Advances Summary
          </h1>
          <p className="text-gray-500">
            View cash advance ledger by employee
          </p>
        </div>
      </div>

      {/* Employee Search */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Employee
        </label>
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder={
                loadingEmployees
                  ? 'Loading employees...'
                  : 'Search employee name...'
              }
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                setShowDropdown(true)
                if (selectedEmployee) {
                  setSelectedEmployee(null)
                  setSummaryData(null)
                }
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>

          {showDropdown && !loadingEmployees && (
            <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl max-h-56 overflow-y-auto">
              {filteredEmployees.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No employees found
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 text-gray-900 transition-colors ${
                      selectedEmployee?.id === emp.id
                        ? 'bg-blue-50'
                        : ''
                    }`}
                  >
                    <p className="text-sm font-medium">{emp.fullName}</p>
                    <p className="text-xs text-gray-400">
                      {emp.employeeId}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-500">
          Loading summary...
        </div>
      )}

      {error && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      )}

      {summaryData && !loading && (
        <>
          {/* Employee Header Card */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">
                  Employee
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  {summaryData.employee.fullName}
                </h2>
                <p className="text-blue-200 text-sm mt-1">
                  ID: {summaryData.employee.employeeId}
                </p>
              </div>
              <button
                onClick={handleClearSelection}
                className="text-blue-200 hover:text-white text-sm underline"
              >
                Change Employee
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Total Cash Advances
              </p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(summaryData.summary.totalDebits)}
              </p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Total Payments Made
              </p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {formatCurrency(summaryData.summary.totalCredits)}
              </p>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                Current Balance
              </p>
              <p
                className={`text-xl font-bold mt-1 ${
                  summaryData.summary.currentBalance > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}
              >
                {formatCurrency(summaryData.summary.currentBalance)}
              </p>
            </div>
          </div>

          {/* Flat Ledger Table */}
          {summaryData.entries.length > 0 ? (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Debit (Advance)
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Credit (Deduction)
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summaryData.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          entry.type === 'DEBIT' ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="px-6 py-3 text-gray-700">
                          {format(new Date(entry.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                entry.type === 'DEBIT'
                                  ? 'bg-blue-500'
                                  : 'bg-green-500'
                              }`}
                            />
                            <span className="text-gray-900">
                              {entry.description}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-blue-600">
                          {entry.type === 'DEBIT'
                            ? formatCurrency(entry.amount)
                            : '-'}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-green-600">
                          {entry.type === 'CREDIT'
                            ? formatCurrency(entry.amount)
                            : '-'}
                        </td>
                        <td
                          className={`px-6 py-3 text-right font-bold ${
                            entry.runningBalance > 0
                              ? 'text-red-600'
                              : entry.runningBalance < 0
                                ? 'text-orange-600'
                                : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-900">
                No cash advances found
              </p>
              <p className="text-sm mt-1">
                This employee has no cash advance records.
              </p>
            </div>
          )}
        </>
      )}

      {!selectedEmployee && !loading && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-500">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-medium text-gray-900">
            Select an employee to view their advances summary
          </p>
          <p className="text-sm mt-1">
            Search by employee name above to get started.
          </p>
        </div>
      )}
    </div>
  )
}
