'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTimeLogs } from '@/hooks/use-time-logs';
import { useEmployees, Employee as EmployeeBase } from '@/hooks/use-employees';
import { CheckCircle2, AlertCircle, Search, ClipboardCheck, XCircle, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Employee extends EmployeeBase {
  userId: string | null;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface TimeLog {
  id: string;
  employeeId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workHours: number;
  shift: Shift | null;
  employee: {
    fullName: string;
    employeeId: string;
  };
}

function getCookies() {
  if (typeof document === 'undefined') return { loggedIn: false, role: '', id: '', email: '' };
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  return {
    loggedIn: cookies.isLoggedIn === 'true',
    role: cookies.userRole || '',
    id: cookies.userId || '',
    email: cookies.userEmail || ''
  };
}

function getStatusFromLog(log: TimeLog): { label: string; color: string; icon: React.ReactNode } {
  // If no clock in, the employee was absent
  if (!log.clockIn) {
    return {
      label: 'Absent',
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <XCircle className="w-3 h-3 mr-1" />,
    };
  }

  // If no shift schedule, just show Present
  if (!log.shift || log.shift.startTime === '-') {
    return {
      label: 'Present',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    };
  }

  try {
    const clockInDate = new Date(log.clockIn);
    const [shiftHour, shiftMinute] = log.shift.startTime.split(':').map(Number);

    const scheduledStartTime = new Date(clockInDate);
    scheduledStartTime.setUTCHours(shiftHour, shiftMinute, 0, 0);

    const diffInMinutes = (clockInDate.getTime() - scheduledStartTime.getTime()) / (1000 * 60);

    if (diffInMinutes > 1) {
      const hours = Math.floor(diffInMinutes / 60);
      const mins = Math.floor(diffInMinutes % 60);
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return {
        label: `Late (${timeStr})`,
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle className="w-3 h-3 mr-1" />,
      };
    }

    return {
      label: 'On Time',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    };
  } catch {
    return {
      label: 'Present',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    };
  }
}

export default function AttendancePage() {
  const [userRole, setUserRole] = useState('');
  const [currentEmployeeId, setCurrentEmployeeId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('thisMonth');

  const { data: timeLogs = [], isLoading } = useTimeLogs();
  const { data: employeesData = [] } = useEmployees();

  useEffect(() => {
    const { loggedIn, role } = getCookies();
    if (!loggedIn) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    setUserRole(role || '');
  }, []);

  useEffect(() => {
    if (!employeesData.length) return;
    const { role, id, email } = getCookies();

    if (role === 'EMPLOYEE' && email) {
      const lowerEmail = email.toLowerCase();
      const myEmployee = employeesData.find((emp) => emp.email?.toLowerCase() === lowerEmail);
      if (myEmployee) {
        setCurrentEmployeeId(myEmployee.id);
        return;
      }
      const myEmployeeByUserId = (employeesData as Employee[]).find((emp) => emp.userId === id);
      if (myEmployeeByUserId) {
        setCurrentEmployeeId(myEmployeeByUserId.id);
        return;
      }
      setEmployees([]);
      return;
    }
  }, [employeesData]);

  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (!employeesData.length) return;
    const { role } = getCookies();
    if (role !== 'EMPLOYEE') {
      setEmployees(employeesData as Employee[]);
    }
  }, [employeesData]);

  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'HR';

  // Filter logs by date range
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const manilaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayStr = manilaNow.toISOString().split('T')[0];

    const startOfMonth = new Date(manilaNow.getFullYear(), manilaNow.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    const startOfWeek = new Date(manilaNow);
    startOfWeek.setDate(manilaNow.getDate() - manilaNow.getDay());
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    const last7Days = new Date(manilaNow);
    last7Days.setDate(manilaNow.getDate() - 7);
    const last7DaysStr = last7Days.toISOString().split('T')[0];

    const last30Days = new Date(manilaNow);
    last30Days.setDate(manilaNow.getDate() - 30);
    const last30DaysStr = last30Days.toISOString().split('T')[0];

    let filtered = timeLogs;

    if (dateFilter === 'today') {
      filtered = timeLogs.filter((log: TimeLog) => log.date.startsWith(todayStr));
    } else if (dateFilter === 'thisWeek') {
      filtered = timeLogs.filter((log: TimeLog) => log.date >= startOfWeekStr);
    } else if (dateFilter === 'thisMonth') {
      filtered = timeLogs.filter((log: TimeLog) => log.date >= startOfMonthStr);
    } else if (dateFilter === 'last7Days') {
      filtered = timeLogs.filter((log: TimeLog) => log.date >= last7DaysStr);
    } else if (dateFilter === 'last30Days') {
      filtered = timeLogs.filter((log: TimeLog) => log.date >= last30DaysStr);
    }

    // If employee role, only show their own logs
    if (userRole === 'EMPLOYEE' && currentEmployeeId) {
      filtered = filtered.filter((log: TimeLog) => log.employeeId === currentEmployeeId);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((log: TimeLog) =>
        log.employee?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.employee?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [timeLogs, dateFilter, searchTerm, userRole, currentEmployeeId]);

  // Compute summary stats
  const summary = useMemo(() => {
    let onTime = 0;
    let late = 0;
    let absent = 0;

    for (const log of filteredLogs) {
      const status = getStatusFromLog(log);
      if (status.label === 'On Time') onTime++;
      else if (status.label.startsWith('Late')) late++;
      else if (status.label === 'Absent') absent++;
    }

    return { onTime, late, absent, total: filteredLogs.length };
  }, [filteredLogs]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {isAdminOrManager ? 'View employee attendance records' : 'View your attendance records'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Records</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">On Time</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{summary.onTime}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Late</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{summary.late}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Absent</p>
              <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{summary.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            >
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
              <option value="last7Days">Last 7 Days</option>
              <option value="last30Days">Last 30 Days</option>
              <option value="all">All Records</option>
            </select>
          </div>

          {/* Search */}
          {isAdminOrManager && (
            <div className="relative flex-1 max-w-sm">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search employee name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>
          )}

          {/* Record count */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>No attendance records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  {isAdminOrManager && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Employee</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Schedule</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clock In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clock Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredLogs.map((log: TimeLog) => {
                  const status = getStatusFromLog(log);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-900 dark:text-gray-200">
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{formatDate(log.date)}</td>
                      {isAdminOrManager && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">
                                {log.employee?.fullName?.[0] || 'E'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium dark:text-gray-200">{log.employee?.fullName || 'Unknown'}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{log.employee?.employeeId}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {log.shift ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-600 text-xs">{log.shift.name}</span>
                            <span className="text-xs text-gray-500">{log.shift.startTime} - {log.shift.endTime}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No Schedule</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{formatTime(log.clockIn)}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{formatTime(log.clockOut)}</td>
                      <td className="px-6 py-4 text-sm">{log.clockIn ? `${log.workHours.toFixed(2)}h` : '-'}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <Badge variant="outline" className={`${status.color} border flex items-center w-fit`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
