'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, User, Mail, Briefcase, Building, DollarSign, Calendar, CreditCard, Pencil, Trash2, X, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Employee {
  id: string;
  employeeNumber: number;
  fullName: string;
  email: string;
  employeeId: string;
  position: string;
  department: string;
  payType: string;
  basicSalary: number;
  dailyRate: number;
  payrollFrequency: string;
  hireDate: string;
  isActive: boolean;
  employeeStatus: string;
  regularizationDate?: string;
  managerId?: string;
  tin: string;
  sssNo: string;
  philhealthNo: string;
  pagibigNo: string;
  bankName: string;
  bankAccountNo: string;
}

const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'Engineering', 'Admin'];
const frequencies = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'SEMIMONTHLY', label: 'Semi-monthly' },
  { value: 'MONTHLY', label: 'Monthly' }
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  
  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    position: '',
    department: '',
    payType: 'MONTHLY',
    basicSalary: '',
    dailyRate: '',
    payrollFrequency: 'MONTHLY',
    managerId: '',
    hireDate: '',
    tin: '',
    sssNo: '',
    philhealthNo: '',
    pagibigNo: '',
    bankName: '',
    bankAccountNo: '',
    employeeStatus: 'PROBATIONARY',
    regularizationDate: '',
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const getCookies = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      return { role: cookies.userRole || '', loggedIn: cookies.isLoggedIn === 'true' };
    };
    
    const { role, loggedIn } = getCookies();
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    setUserRole(role);
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      console.log('API Response status:', res.status);
      console.log('API Response data type:', typeof data, Array.isArray(data));
      console.log('API Response data:', data);
      if (Array.isArray(data)) {
        setEmployees(data);
      } else {
        console.error('API returned error:', data);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        ...(selectedEmployee ? { id: selectedEmployee.id } : {}),
        ...formData,
        basicSalary: parseFloat(formData.basicSalary || '0'),
        dailyRate: parseFloat(formData.dailyRate || '0'),
        managerId: formData.managerId || null
      };

      const res = await fetch('/api/employees', {
        method: selectedEmployee ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save employee');
        return;
      }

      setShowModal(false);
      setSelectedEmployee(null);
      resetForm();
      fetchEmployees();
    } catch (err) {
      setError('Something went wrong');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '', fullName: '', email: '', position: '', department: '',
      payType: 'MONTHLY', basicSalary: '', dailyRate: '',
      payrollFrequency: 'MONTHLY', managerId: '', hireDate: '',
      tin: '', sssNo: '', philhealthNo: '', pagibigNo: '',
      bankName: '', bankAccountNo: '',
      employeeStatus: 'PROBATIONARY', regularizationDate: '',
    });
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      payType: employee.payType || 'MONTHLY',
      basicSalary: employee.basicSalary?.toString() || '0',
      dailyRate: employee.dailyRate?.toString() || '0',
      payrollFrequency: employee.payrollFrequency || 'MONTHLY',
      managerId: employee.managerId || '',
      hireDate: employee.hireDate.split('T')[0],
      tin: employee.tin || '',
      sssNo: employee.sssNo || '',
      philhealthNo: employee.philhealthNo || '',
      pagibigNo: employee.pagibigNo || '',
      bankName: employee.bankName || '',
      bankAccountNo: employee.bankAccountNo || '',
      employeeStatus: employee.employeeStatus || 'PROBATIONARY',
      regularizationDate: employee.regularizationDate ? employee.regularizationDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      const res = await fetch(`/api/employees?id=${selectedEmployee.id}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteModal(false);
        setSelectedEmployee(null);
        fetchEmployees();
      }
    } catch (err) {
      alert('Something went wrong');
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAdmin = userRole === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500">Manage employee records and payroll rates</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setSelectedEmployee(null); resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus className="w-5 h-5" /> Add Employee
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Loading employees...
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pay Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rate/Salary</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                {isAdmin && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {employee.fullName[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{employee.fullName}</p>
                        <p className="text-xs text-gray-500">ID: {employee.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                      employee.payType === 'DAILY' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {employee.payType || 'MONTHLY'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">
                        ₱{employee.payType === 'DAILY' 
                          ? (employee.dailyRate || 0).toLocaleString() 
                          : (employee.basicSalary || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400 uppercase font-medium">
                        {employee.payType === 'DAILY' ? 'per day' : 'per month'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-600">{employee.department}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                        employee.employeeStatus === 'REGULAR' ? 'bg-blue-100 text-blue-700' :
                        employee.employeeStatus === 'PROBATIONARY' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {employee.employeeStatus || 'PROBATIONARY'}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                        employee.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(employee)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => { setSelectedEmployee(employee); setShowDeleteModal(true); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><User className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold text-gray-900">{selectedEmployee ? 'Edit Employee Profile' : 'Register New Employee'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100">{error}</div>}

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Personal & Role Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Full Name *</Label>
                    <Input name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Juan R. Dela Cruz" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Employee ID *</Label>
                    <Input name="employeeId" value={formData.employeeId} onChange={handleChange} required placeholder="EMP-0001" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Work Email *</Label>
                    <Input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="juan@company.com" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Position *</Label>
                    <Input name="position" value={formData.position} onChange={handleChange} required placeholder="Senior Developer" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Department *</Label>
                    <select name="department" value={formData.department} onChange={handleChange} required className="w-full h-11 px-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Employment Status</Label>
                    <select name="employeeStatus" value={formData.employeeStatus} onChange={handleChange} className="w-full h-11 px-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                      <option value="PROBATIONARY">Probationary</option>
                      <option value="REGULAR">Regular</option>
                      <option value="RESIGNED">Resigned</option>
                      <option value="TERMINATED">Terminated</option>
                      <option value="ONDESIGN">On Designation</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Regularization Date</Label>
                    <Input type="date" name="regularizationDate" value={formData.regularizationDate} onChange={handleChange} className="h-11" />
                    <p className="text-xs text-gray-400">Required when status is Regular</p>
                  </div>
                </div>
              </section>

              <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Payroll & Salary Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Payment Type *</Label>
                    <select name="payType" value={formData.payType} onChange={handleChange} required className="w-full h-11 px-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-bold">
                      <option value="MONTHLY">Fixed Monthly Salary</option>
                      <option value="DAILY">Daily Rate Basis</option>
                    </select>
                  </div>

                  {formData.payType === 'DAILY' ? (
                    <div className="space-y-1.5 animate-in slide-in-from-left-2 duration-200">
                      <Label className="text-xs font-bold uppercase text-gray-500 text-orange-600">Daily Rate (PHP) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₱</span>
                        <Input type="number" name="dailyRate" value={formData.dailyRate} onChange={handleChange} required placeholder="650" className="h-11 pl-8 border-orange-200 focus:ring-orange-500" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 animate-in slide-in-from-left-2 duration-200">
                      <Label className="text-xs font-bold uppercase text-gray-500 text-blue-600">Basic Monthly Salary (PHP) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₱</span>
                        <Input type="number" name="basicSalary" value={formData.basicSalary} onChange={handleChange} required placeholder="25000" className="h-11 pl-8 border-blue-200" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Payroll Frequency *</Label>
                    <select name="payrollFrequency" value={formData.payrollFrequency} onChange={handleChange} required className="w-full h-11 px-3 border rounded-lg bg-white">
                      {frequencies.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Hire Date *</Label>
                    <Input type="date" name="hireDate" value={formData.hireDate} onChange={handleChange} required className="h-11" />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Government IDs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">TIN *</Label>
                    <Input name="tin" value={formData.tin} onChange={handleChange} required placeholder="000-000-000-000" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">SSS No. *</Label>
                    <Input name="sssNo" value={formData.sssNo} onChange={handleChange} required placeholder="00-0000000-0" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">PhilHealth No. *</Label>
                    <Input name="philhealthNo" value={formData.philhealthNo} onChange={handleChange} required placeholder="00-000000000-0" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Pag-IBIG MID *</Label>
                    <Input name="pagibigNo" value={formData.pagibigNo} onChange={handleChange} required placeholder="0000-0000-0000" className="h-11" />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Bank Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Bank Name</Label>
                    <Input name="bankName" value={formData.bankName} onChange={handleChange} placeholder="e.g. BDO, BPI, GCash" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-gray-500">Account Number</Label>
                    <Input name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange} placeholder="0000000000" className="h-11" />
                  </div>
                </div>
              </section>

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white py-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 h-12">Cancel</Button>
                <Button type="submit" className="flex-1 h-12 bg-blue-600 hover:bg-blue-700">{selectedEmployee ? 'Update Profile' : 'Create Employee'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 className="w-10 h-10" /></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Profile?</h2>
              <p className="text-gray-500 mb-8 text-sm leading-relaxed">This will permanently remove <strong>{selectedEmployee?.fullName}</strong> from the system. This action cannot be reversed.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1 h-11">No, Keep it</Button>
                <Button onClick={handleDelete} className="flex-1 h-11 bg-red-600 hover:bg-red-700">Yes, Delete</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
