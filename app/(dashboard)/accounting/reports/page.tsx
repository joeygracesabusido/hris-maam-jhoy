'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Download, RefreshCcw } from 'lucide-react';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('trial-balance');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  async function fetchReport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/reports/${activeReport}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-muted-foreground">Real-time financial statements based on your General Ledger</p>
        </div>
        <Button variant="outline" onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <CardTitle>Trial Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">Loading report...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Total Debit</TableHead>
                      <TableHead className="text-right">Total Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map((acc: any) => (
                      <TableRow key={acc.code}>
                        <TableCell className="font-mono">{acc.code}</TableCell>
                        <TableCell>{acc.name}</TableCell>
                        <TableCell>{acc.type}</TableCell>
                        <TableCell className="text-right">₱{acc.totalDebit.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₱{acc.totalCredit.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">₱{acc.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={3}>Grand Totals</TableCell>
                      <TableCell className="text-right">₱{data?.grandTotalDebit?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₱{data?.grandTotalCredit?.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {data?.isBalanced ? (
                          <span className="text-green-600">Balanced</span>
                        ) : (
                          <span className="text-red-600">Unbalanced</span>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income-statement">
          <Card>
            <CardHeader>
              <CardTitle>Income Statement (P&L)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">Loading report...</div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Revenue</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.revenue.map((rev: any) => (
                          <TableRow key={rev.code}>
                            <TableCell>{rev.name}</TableCell>
                            <TableCell className="text-right">₱{rev.balance.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t">
                          <TableCell>Total Revenue</TableCell>
                          <TableCell className="text-right">₱{data?.revenue.reduce((sum: number, r: any) => sum + r.balance, 0).toLocaleString()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Expenses</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.expenses.map((exp: any) => (
                          <TableRow key={exp.code}>
                            <TableCell>{exp.name}</TableCell>
                            <TableCell className="text-right">₱{exp.balance.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t">
                          <TableCell>Total Expenses</TableCell>
                          <TableCell className="text-right">₱{data?.expenses.reduce((sum: number, e: any) => sum + e.balance, 0).toLocaleString()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-muted rounded-lg border">
                    <span className="text-xl font-bold">Net Income</span>
                    <span className={`text-2xl font-bold ${data?.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₱{data?.netIncome.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle>Balance Sheet</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">Loading report...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Assets</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.assets.map((asset: any) => (
                          <TableRow key={asset.code}>
                            <TableCell>{asset.name}</TableCell>
                            <TableCell className="text-right">₱{asset.balance.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right">₱{data?.totalAssets.toLocaleString()}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Liabilities</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.liabilities.map((liab: any) => (
                            <TableRow key={liab.code}>
                              <TableCell>{liab.name}</TableCell>
                              <TableCell className="text-right">₱{liab.balance.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Equity</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.equity.map((eq: any) => (
                            <TableRow key={eq.code}>
                              <TableCell>{eq.name}</TableCell>
                              <TableCell className="text-right">₱{eq.balance.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-muted rounded-lg border font-bold">
                      <span>Total Liabilities & Equity</span>
                      <span>₱{data?.totalLiabilitiesEquity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
