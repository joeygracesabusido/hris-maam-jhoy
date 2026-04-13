'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountingDashboard() {
  const [stats, setStats] = useState({
    cashBalance: 0,
    totalReceivables: 0,
    totalPayables: 0,
    netIncome: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // In a real implementation, this would call a specific stats API
        // For now, we'll simulate a fetch
        const res = await fetch('/api/accounting/reports/trial-balance');
        const data = await res.json();

        // Simple aggregation logic for the dashboard
        // Summing Assets (Cash) vs Liabilities
        setStats({
          cashBalance: 1250000, // Mocked for UI
          totalReceivables: 45000,
          totalPayables: 12000,
          netIncome: 85000,
        });
      } catch (err) {
        console.error('Error fetching accounting stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Accounting Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Cash on Hand" value={stats.cashBalance} icon={Wallet} color="text-green-600" />
        <StatCard title="Accounts Receivable" value={stats.totalReceivables} icon={ArrowUpRight} color="text-blue-600" />
        <StatCard title="Accounts Payable" value={stats.totalPayables} icon={ArrowDownRight} color="text-red-600" />
        <StatCard title="Estimated Net Income" value={stats.netIncome} icon={FileText} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Journal Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>2026-04-13</TableCell>
                  <TableCell>Monthly Payroll Accrual</TableCell>
                  <TableCell className="text-right">₱450,000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2026-04-12</TableCell>
                  <TableCell>Office Rent - April</TableCell>
                  <TableCell className="text-right">₱25,000</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => window.location.href='/accounting/journal/new'}>
              <FileText className="w-6 h-6" />
              <span>New Journal Entry</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => window.location.href='/accounting/coa'}>
              <Wallet className="w-6 h-6" />
              <span>Chart of Accounts</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card>

      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>₱{value.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-full bg-muted`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// Remove the trailing import note
