'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTimeLogs, useOfficeLocations, useClockIn, useClockOut, useEmployeeFaceDescriptor } from '@/hooks/use-time-logs';
import { useEmployees, Employee as EmployeeBase } from '@/hooks/use-employees';
import { queryKeys } from '@/lib/query-keys';
import { ApiError } from '@/lib/api-client';
import {
  Clock, MapPin, NavigationOff, CheckCircle2, Play, Square, User, X
} from 'lucide-react';
import dynamic from 'next/dynamic';

const FaceCapture = dynamic(
  () => import('@/components/facial-recognition/FaceCapture'),
  { ssr: false }
);

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

export default function AttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRole, setUserRole] = useState('');
  const [storedDescriptor, setStoredDescriptor] = useState<number[] | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState('');
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [distances, setDistances] = useState<Map<string, number>>(new Map());
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [withinRange, setWithinRange] = useState(false);
  const [closestLocation, setClosestLocation] = useState<{ name: string; distance: number } | null>(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [faceEnrollStatus, setFaceEnrollStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const queryClient = useQueryClient();
  const { data: timeLogs = [] } = useTimeLogs();
  const { data: employeesData = [] } = useEmployees();
  const { data: officeLocations = [] } = useOfficeLocations();
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const faceDescriptorQuery = useEmployeeFaceDescriptor(employeeId || '');

  useEffect(() => {
    const { loggedIn, role } = getCookies();
    if (!loggedIn) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    setUserRole(role || '');
    getUserLocation();
  }, []);

  useEffect(() => {
    if (!employeesData.length) return;
    const { role, id, email } = getCookies();

    if (role === 'EMPLOYEE' && email) {
      const lowerEmail = email.toLowerCase();
      const myEmployee = employeesData.find((emp) => emp.email?.toLowerCase() === lowerEmail);
      if (myEmployee) {
        setEmployeeId(myEmployee.id);
        setEmployees([myEmployee as Employee]);
        return;
      }
      const myEmployeeByUserId = (employeesData as Employee[]).find((emp) => emp.userId === id);
      if (myEmployeeByUserId) {
        setEmployeeId(myEmployeeByUserId.id);
        setEmployees([myEmployeeByUserId]);
        return;
      }
      console.error('[Attendance] EMPLOYEE role but no matching employee found for email:', email);
      setEmployees([]);
      return;
    }

    setEmployees(employeesData as Employee[]);

    if ((role === 'ADMIN' || role === 'MANAGER' || role === 'HR') && email) {
      const myEmployee = employeesData.find((emp) => emp.email?.toLowerCase() === email.toLowerCase());
      if (myEmployee) {
        setEmployeeId(myEmployee.id);
        return;
      }
    }

    if (employeesData.length > 0) {
      setEmployeeId(employeesData[0].id);
    }
  }, [employeesData]);

  useEffect(() => {
    if (timeLogs.length > 0 && employeeId) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      const todayEntry = timeLogs.find((log: TimeLog) =>
        log.date.startsWith(today) && log.employeeId === employeeId
      );
      setTodayLog(todayEntry || null);
    }
  }, [timeLogs, employeeId]);

  useEffect(() => {
    if (showFaceModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showFaceModal]);

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setGpsError(null);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setGpsError('Unable to access your location. Please enable location services.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  useEffect(() => {
    if (userLocation && officeLocations.length > 0) {
      const newDistances = new Map<string, number>();
      let minDistance = Infinity;
      let closestName = '';

      for (const loc of officeLocations) {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          loc.latitude,
          loc.longitude
        );
        newDistances.set(loc.id, dist);
        if (dist < minDistance) {
          minDistance = dist;
          closestName = loc.name;
        }
      }

      setDistances(newDistances);
      const anyInRange = officeLocations.some(loc => {
        const dist = newDistances.get(loc.id) || Infinity;
        return dist <= loc.radius;
      });
      setWithinRange(anyInRange);
      setClosestLocation(minDistance !== Infinity ? { name: closestName, distance: minDistance } : null);
    }
  }, [userLocation, officeLocations]);

  const handleClockIn = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    if (!userLocation && officeLocations.length > 0) {
      alert('Please enable location services to clock in');
      getUserLocation();
      return;
    }

    if (officeLocations.length > 0 && !withinRange) {
      const locNames = officeLocations.map(l => l.name).join(', ');
      alert(`You must be within range of at least one office location to clock in.\nAvailable locations: ${locNames}\nCurrent distance to closest: ${Math.round(closestLocation?.distance || 0)}m`);
      return;
    }

    setClockingIn(true);
    try {
      await clockInMutation.mutateAsync({
        employeeId,
        date: new Date().toISOString().split('T')[0],
        clockIn: new Date().toISOString(),
        location: userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() });
      alert('Clock in recorded successfully!');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      alert(msg);
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    if (!userLocation && officeLocations.length > 0) {
      alert('Please enable location services to clock out');
      getUserLocation();
      return;
    }

    if (officeLocations.length > 0 && !withinRange) {
      const locNames = officeLocations.map(l => l.name).join(', ');
      alert(`You must be within range of at least one office location to clock out.\nAvailable locations: ${locNames}\nCurrent distance to closest: ${Math.round(closestLocation?.distance || 0)}m`);
      return;
    }

    setClockingIn(true);
    try {
      await clockOutMutation.mutateAsync({
        employeeId,
        date: new Date().toISOString().split('T')[0],
        clockOut: new Date().toISOString(),
        location: userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeLogs.lists() });
      alert('Clock out recorded successfully!');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      alert(msg);
    } finally {
      setClockingIn(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const canClockIn = (!todayLog || !todayLog.clockIn);
  const canClockOut = !!(todayLog && todayLog.clockIn && !todayLog.clockOut);

  const handleVerifyFace = async (isMatch: boolean, distance: number) => {
    if (isMatch) {
      if (canClockIn) {
        await handleClockIn();
      } else if (canClockOut) {
        await handleClockOut();
      }
      setShowFaceModal(false);
      setIsVerifying(false);
    } else {
      alert(`Identity verification failed. Match distance: ${distance.toFixed(2)}. Please try again.`);
      setIsVerifying(false);
    }
  };

  const initiateVerification = async () => {
    if (!employeeId) {
      alert('No employee selected');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await faceDescriptorQuery.refetch();
      if (result.error) {
        if (result.error instanceof ApiError) {
          if (result.error.status === 404) {
            throw new Error('Employee has not enrolled their face. Please contact HR to complete face enrollment.');
          }
          if (result.error.status === 401) {
            throw new Error('Session expired. Please login again.');
          }
          throw new Error(result.error.message || 'Failed to load face data');
        }
        throw new Error('Failed to load face data');
      }

      const data = result.data as { faceDescriptor: number[] };
      if (!data.faceDescriptor || data.faceDescriptor.length === 0) {
        throw new Error('Employee has not enrolled their face. Please contact HR to complete face enrollment.');
      }

      setStoredDescriptor(data.faceDescriptor);
      setShowFaceModal(true);
    } catch (err: unknown) {
      console.error('[Face Verification] Error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      alert(error.message);
      setIsVerifying(false);
    }
  };

  const handleFaceEnroll = async (descriptor: Float32Array) => {
    if (!employeeId) return;
    setFaceEnrollStatus(null);

    try {
      const res = await fetch(`/api/employees/${employeeId}/face`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ faceDescriptor: Array.from(descriptor) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFaceEnrollStatus({ ok: false, msg: data.error || 'Failed to enroll face' });
        return;
      }

      setFaceEnrollStatus({ ok: true, msg: '✓ Your face has been enrolled successfully!' });
      setTimeout(() => { setShowFaceModal(false); setIsEnrolling(false); setFaceEnrollStatus(null); }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setFaceEnrollStatus({ ok: false, msg });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
          <p className="text-gray-500 dark:text-gray-400">Record your daily attendance</p>
        </div>
        {userRole === 'EMPLOYEE' && employeeId && (
          <button
            onClick={() => { setIsEnrolling(true); setFaceEnrollStatus(null); setShowFaceModal(true); }}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <User className="w-4 h-4" />
            Enroll My Face
          </button>
        )}
      </div>

      {/* Clock In/Out Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Clock Icon */}
          <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <Clock className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          
          {/* Date & Time */}
          <div className="text-center">
            <p className="text-lg font-medium dark:text-gray-200">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                timeZone: 'Asia/Manila'
              })}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {new Date().toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Asia/Manila'
              })}
            </p>
          </div>

          {/* GPS Status */}
          <div className={`w-full max-w-md rounded-lg p-4 border-2 ${
            !officeLocations.length 
              ? 'bg-blue-50 border-blue-200'
              : withinRange 
                ? 'bg-green-50 border-green-200' 
                : gpsError
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-3">
              {!officeLocations.length ? (
                <MapPin className="w-8 h-8 text-blue-600" />
              ) : withinRange ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <NavigationOff className="w-8 h-8 text-red-600" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {!officeLocations.length 
                    ? 'GPS Not Required' 
                    : withinRange 
                      ? 'Within Clock-In Range' 
                      : 'Outside Clock-In Range'}
                </p>
                <p className="text-sm text-gray-600">
                  {!officeLocations.length ? (
                    'No office location configured. Clock-in is allowed from anywhere.'
                  ) : gpsError ? (
                    <span className="text-red-600">{gpsError}</span>
                  ) : userLocation === null ? (
                    'Click refresh to get your location'
                  ) : officeLocations.length > 0 ? (
                    <div className="space-y-1">
                      {officeLocations.map((loc) => {
                        const dist = distances.get(loc.id);
                        const inRange = dist !== undefined && dist <= loc.radius;
                        return (
                          <div key={loc.id} className="flex items-center gap-1">
                            <span className={inRange ? 'text-green-600' : 'text-red-600'}>
                              {inRange ? '✓' : '✗'}
                            </span>
                            <span>{loc.name}: {Math.round(dist || 0)}m / {loc.radius}m</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    'Getting location...'
                  )}
                </p>
              </div>
              {officeLocations.length > 0 && (
                <button 
                  onClick={getUserLocation}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  title="Refresh location"
                >
                  <NavigationOff className="w-5 h-5 text-gray-500" />
                </button>
              )}
            </div>
          </div>

          {/* Employee Selector */}
          <div className="w-full max-w-md">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeId || `#${emp.employeeNumber}`})
                </option>
              ))}
            </select>
          </div>

          {/* Clock In/Out Buttons */}
          <div className="flex gap-4 w-full max-w-md">
            <button
              onClick={() => {
                if (officeLocations.length > 0) {
                  if (!userLocation) {
                    alert('Please enable location services to clock in. ' + (gpsError || ''));
                    getUserLocation();
                    return;
                  }
                  if (!withinRange) {
                    const locNames = officeLocations.map(l => l.name).join(', ');
                    alert(`You must be within range of at least one office location to clock in.\nAvailable locations: ${locNames}\nCurrent distance to closest: ${Math.round(closestLocation?.distance || 0)}m`);
                    return;
                  }
                }
                if (canClockIn) initiateVerification();
              }}
              disabled={!canClockIn || clockingIn}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                canClockIn
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
              }`}
            >
              <Play className="w-5 h-5" />
              {clockingIn ? 'Processing...' : 'Clock In'}
            </button>

            <button
              onClick={() => {
                if (officeLocations.length > 0) {
                  if (!userLocation) {
                    alert('Please enable location services to clock out. ' + (gpsError || ''));
                    getUserLocation();
                    return;
                  }
                  if (!withinRange) {
                    const locNames = officeLocations.map(l => l.name).join(', ');
                    alert(`You must be within range of at least one office location to clock out.\nAvailable locations: ${locNames}\nCurrent distance to closest: ${Math.round(closestLocation?.distance || 0)}m`);
                    return;
                  }
                }
                if (canClockOut) initiateVerification();
              }}
              disabled={!canClockOut || clockingIn}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                canClockOut
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
              }`}
            >
              <Square className="w-5 h-5" />
              {clockingIn ? 'Processing...' : 'Clock Out'}
            </button>
          </div>

          {/* Today's Status */}
          {todayLog && employeeId === todayLog.employeeId && (
            <div className="w-full max-w-md bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border dark:border-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Today&apos;s Status</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Clock In</p>
                  <p className="font-medium dark:text-white">{formatTime(todayLog.clockIn)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Clock Out</p>
                  <p className="font-medium dark:text-white">{formatTime(todayLog.clockOut)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Hours Worked</p>
                  <p className="font-medium dark:text-white">{todayLog.workHours.toFixed(2)} hours</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Face Verification/Enrollment Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${isEnrolling ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isEnrolling ? 'Face Enrollment' : 'Face Verification'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {isEnrolling ? 'Capture your face for attendance verification' : 'Please verify your identity to continue'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowFaceModal(false); setIsVerifying(false); setIsEnrolling(false); setFaceEnrollStatus(null); }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {faceEnrollStatus && (
                <div className={`p-3 rounded-lg border text-sm font-medium ${
                  faceEnrollStatus.ok
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {faceEnrollStatus.msg}
                </div>
              )}
              {isEnrolling ? (
                <FaceCapture mode="enroll" onCapture={handleFaceEnroll} />
              ) : (
                <FaceCapture
                  mode="verify"
                  storedDescriptor={storedDescriptor}
                  onVerify={handleVerifyFace}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
