'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ArrowLeft, DollarSign, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { format } from 'date-fns/format'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { useEmployees } from '@/hooks/use-employees'
import { useAdvanceSummary } from '@/hooks/use-advances'

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
  const employeesQuery = useEmployees();
  const employees = (employeesQuery.data ?? []) as unknown as Employee[];
  const loadingEmployees = employeesQuery.isLoading;
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const summaryQuery = useAdvanceSummary(selectedEmployee?.id ?? '');
  const summaryData = (summaryQuery.data ?? null) as unknown as SummaryData | null;
  const loading = summaryQuery.isLoading;
  const [error, setError] = useState('')
  const [exportingAll, setExportingAll] = useState(false)

  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (selectedEmployee) {
      setError('')
    }
  }, [selectedEmployee])

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp)
    setSearchText(emp.fullName)
    setShowDropdown(false)
  }

  const handleClearSelection = () => {
    setSelectedEmployee(null)
    setSearchText('')
    setError('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const handleExportAllExcel = async () => {
    try {
      setExportingAll(true)
      const res = await fetch('/api/advances/summary?employeeId=all')
      if (!res.ok) throw new Error('Failed to fetch summary data')
      const data = await res.json()

      const rows: (string | number)[][] = [
        ['EMPLOYEE CASH ADVANCES SUMMARY REPORT'],
        [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
        [],
        [
          'Employee ID',
          'Employee Name',
          'Total Cash Advances (Debit)',
          'Total Deductions (Credit)',
          'Total Balance',
        ],
      ]

      let totalDebitsSum = 0
      let totalCreditsSum = 0
      let totalBalanceSum = 0

      data.forEach(
        (item: {
          employee: { employeeId: string; fullName: string }
          totalDebits: number
          totalCredits: number
          currentBalance: number
        }) => {
          rows.push([
            item.employee.employeeId || '',
            item.employee.fullName || '',
            item.totalDebits,
            item.totalCredits,
            item.currentBalance,
          ])
          totalDebitsSum += item.totalDebits
          totalCreditsSum += item.totalCredits
          totalBalanceSum += item.currentBalance
        }
      )

      rows.push([])
      rows.push([
        'TOTAL',
        `${data.length} Employee(s)`,
        totalDebitsSum,
        totalCreditsSum,
        totalBalanceSum,
      ])

      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 15 },
        { wch: 32 },
        { wch: 28 },
        { wch: 28 },
        { wch: 20 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'All Balances Summary')

      // If an employee is currently selected, also append their detailed ledger as a second sheet
      if (summaryData) {
        const ledgerRows: (string | number)[][] = [
          [`CASH ADVANCE LEDGER - ${summaryData.employee.fullName.toUpperCase()}`],
          [
            `Employee ID: ${summaryData.employee.employeeId}`,
            `Generated: ${format(new Date(), 'MMM dd, yyyy')}`,
          ],
          [
            `Total Advances: ${formatCurrency(summaryData.summary.totalDebits)}`,
            `Total Deductions: ${formatCurrency(summaryData.summary.totalCredits)}`,
            `Current Balance: ${formatCurrency(summaryData.summary.currentBalance)}`,
          ],
          [],
          [
            'Date',
            'Description',
            'Type',
            'Debit (Advance)',
            'Credit (Deduction)',
            'Running Balance',
          ],
        ]

        summaryData.entries.forEach((entry) => {
          ledgerRows.push([
            format(new Date(entry.date), 'yyyy-MM-dd'),
            entry.description,
            entry.type,
            entry.type === 'DEBIT' ? entry.amount : 0,
            entry.type === 'CREDIT' ? entry.amount : 0,
            entry.runningBalance,
          ])
        })

        ledgerRows.push([])
        ledgerRows.push([
          'TOTAL',
          '',
          '',
          summaryData.summary.totalDebits,
          summaryData.summary.totalCredits,
          summaryData.summary.currentBalance,
        ])

        const ledgerWs = XLSX.utils.aoa_to_sheet(ledgerRows)
        ledgerWs['!cols'] = [
          { wch: 14 },
          { wch: 42 },
          { wch: 12 },
          { wch: 22 },
          { wch: 22 },
          { wch: 22 },
        ]
        const safeName = summaryData.employee.fullName
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 20)
        XLSX.utils.book_append_sheet(workbook, ledgerWs, `${safeName} Ledger`)
      }

      XLSX.writeFile(
        workbook,
        `Cash_Advances_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      )
    } catch (err) {
      console.error('Error exporting excel:', err)
      alert('Failed to export Excel report.')
    } finally {
      setExportingAll(false)
    }
  }

  const handleExportSingleExcel = () => {
    if (!summaryData) return
    try {
      const rows: (string | number)[][] = [
        [`CASH ADVANCE LEDGER - ${summaryData.employee.fullName.toUpperCase()}`],
        [
          `Employee ID: ${summaryData.employee.employeeId}`,
          `Generated: ${format(new Date(), 'MMM dd, yyyy')}`,
        ],
        [
          `Total Advances: ${formatCurrency(summaryData.summary.totalDebits)}`,
          `Total Deductions: ${formatCurrency(summaryData.summary.totalCredits)}`,
          `Current Balance: ${formatCurrency(summaryData.summary.currentBalance)}`,
        ],
        [],
        [
          'Date',
          'Description',
          'Type',
          'Debit (Advance)',
          'Credit (Deduction)',
          'Running Balance',
        ],
      ]

      summaryData.entries.forEach((entry) => {
        rows.push([
          format(new Date(entry.date), 'yyyy-MM-dd'),
          entry.description,
          entry.type,
          entry.type === 'DEBIT' ? entry.amount : 0,
          entry.type === 'CREDIT' ? entry.amount : 0,
          entry.runningBalance,
        ])
      })

      rows.push([])
      rows.push([
        'TOTAL',
        '',
        '',
        summaryData.summary.totalDebits,
        summaryData.summary.totalCredits,
        summaryData.summary.currentBalance,
      ])

      const worksheet = XLSX.utils.aoa_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 42 },
        { wch: 12 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger')
      const fileName = `Cash_Advance_Ledger_${summaryData.employee.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      XLSX.writeFile(workbook, fileName)
    } catch (err) {
      console.error('Error exporting single ledger:', err)
      alert('Failed to export employee ledger.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/payroll"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportAllExcel}
            disabled={exportingAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            title="Export summary report of all employees' total balances to Excel"
          >
            {exportingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>Export All Balances (Excel)</span>
          </button>

          {selectedEmployee && summaryData && (
            <button
              onClick={handleExportSingleExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              title="Export detailed ledger of selected employee to Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Employee Ledger</span>
            </button>
          )}
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
