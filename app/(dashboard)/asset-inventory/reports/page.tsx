'use client';

import { useState, useEffect, useMemo } from 'react';
import { FileDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDepreciation } from '@/lib/depreciation';
import * as XLSX from 'xlsx';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  categoryId?: string | null;
  category?: { name: string } | null;
  purchaseDate: string;
  purchaseCost: number;
  usefulLife: number;
  residualValue: number;
  depreciationMethod: string;
  quantity: number;
  status: string;
  location: string;
}

interface CategoryGroup {
  name: string;
  assets: Asset[];
}

interface QuarterlyData {
  quarter: number;
  dep: number;
  accum: number;
  nbv: number;
}

function getQuarterDate(year: number, quarter: number): Date {
  const monthOffset = (quarter - 1) * 3;
  return new Date(year, monthOffset + 2, 31);
}

export default function PPEReportsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    fetch('/api/assets?status=ACTIVE')
      .then(res => res.json())
      .then(data => {
        setAssets(data || []);
        setLoading(false);
      })
      .catch(() => {
        setAssets([]);
        setLoading(false);
      });
  }, []);

  const groupedAssets = useMemo((): CategoryGroup[] => {
    const groups: Record<string, Asset[]> = {};
    
    assets.forEach(asset => {
      const categoryName = asset.category?.name || 'UNCATEGORIZED';
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(asset);
    });

    return Object.entries(groups)
      .map(([name, assets]) => ({ name, assets }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  const categoryTotals = useMemo(() => {
    return groupedAssets.map(group => {
      let totalCost = 0;
      let totalVat = 0;
      let totalAmount = 0;
      const quarterlyData: QuarterlyData[] = [];

      group.assets.forEach(asset => {
        const cost = asset.purchaseCost * (asset.quantity || 1);
        const vat = cost * 0.12;
        const amount = cost + vat;
        totalCost += cost;
        totalVat += vat;
        totalAmount += amount;
      });

      for (let q = 1; q <= 4; q++) {
        const asOfDate = getQuarterDate(selectedYear, q);
        let quarterDep = 0;
        let quarterAccum = 0;
        let quarterNbv = 0;

        group.assets.forEach(asset => {
          const qty = asset.quantity || 1;
          const prevAsOfDate = getQuarterDate(selectedYear, q - 1);
          
          const prevResult = calculateDepreciation({
            purchaseCost: asset.purchaseCost * qty,
            residualValue: asset.residualValue * qty,
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: prevAsOfDate,
          });

          const currentResult = calculateDepreciation({
            purchaseCost: asset.purchaseCost * qty,
            residualValue: asset.residualValue * qty,
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: asOfDate,
          });

          quarterDep += currentResult.accumulatedDepreciation - prevResult.accumulatedDepreciation;
          quarterAccum += currentResult.accumulatedDepreciation;
          quarterNbv += currentResult.netBookValue;
        });

        quarterlyData.push({
          quarter: q,
          dep: quarterDep,
          accum: quarterAccum,
          nbv: quarterNbv,
        });
      }

      return {
        name: group.name,
        totalCost,
        totalVat,
        totalAmount,
        quarterlyData,
      };
    });
  }, [groupedAssets, selectedYear]);

  const grandTotals = useMemo(() => {
    return categoryTotals.reduce(
      (acc, cat) => ({
        totalCost: acc.totalCost + cat.totalCost,
        totalVat: acc.totalVat + cat.totalVat,
        totalAmount: acc.totalAmount + cat.totalAmount,
        q1: {
          dep: acc.q1.dep + cat.quarterlyData[0]?.dep,
          accum: acc.q1.accum + cat.quarterlyData[0]?.accum,
          nbv: acc.q1.nbv + cat.quarterlyData[0]?.nbv,
        },
        q2: {
          dep: acc.q2.dep + cat.quarterlyData[1]?.dep,
          accum: acc.q2.accum + cat.quarterlyData[1]?.accum,
          nbv: acc.q2.nbv + cat.quarterlyData[1]?.nbv,
        },
        q3: {
          dep: acc.q3.dep + cat.quarterlyData[2]?.dep,
          accum: acc.q3.accum + cat.quarterlyData[2]?.accum,
          nbv: acc.q3.nbv + cat.quarterlyData[2]?.nbv,
        },
        q4: {
          dep: acc.q4.dep + cat.quarterlyData[3]?.dep,
          accum: acc.q4.accum + cat.quarterlyData[3]?.accum,
          nbv: acc.q4.nbv + cat.quarterlyData[3]?.nbv,
        },
      }),
      {
        totalCost: 0,
        totalVat: 0,
        totalAmount: 0,
        q1: { dep: 0, accum: 0, nbv: 0 },
        q2: { dep: 0, accum: 0, nbv: 0 },
        q3: { dep: 0, accum: 0, nbv: 0 },
        q4: { dep: 0, accum: 0, nbv: 0 },
      }
    );
  }, [categoryTotals]);

  const handleExport = () => {
    const excelData: Record<string, unknown>[] = [];

    groupedAssets.forEach(group => {
      group.assets.forEach(asset => {
        const cost = asset.purchaseCost * (asset.quantity || 1);
        const vat = cost * 0.12;
        const amount = cost + vat;

        const row: Record<string, unknown> = {
          'QTY': asset.quantity || 1,
          'UNIT': 'unit',
          'PARTICULARS': asset.name,
          'Date': asset.purchaseDate,
          'COST': cost,
          'VAT': vat,
          'AMOUNT': amount,
          'USEFUL LIFE': asset.usefulLife,
          'MONTHLY DEP': 0,
        };

        for (let q = 1; q <= 4; q++) {
          const asOfDate = getQuarterDate(selectedYear, q);
          const prevAsOfDate = getQuarterDate(selectedYear, q - 1);

          const prevResult = calculateDepreciation({
            purchaseCost: cost,
            residualValue: asset.residualValue * (asset.quantity || 1),
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: prevAsOfDate,
          });

          const currentResult = calculateDepreciation({
            purchaseCost: cost,
            residualValue: asset.residualValue * (asset.quantity || 1),
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: asOfDate,
          });

          row[`Q${q} DEP`] = currentResult.accumulatedDepreciation - prevResult.accumulatedDepreciation;
          row[`Q${q} ACCUM`] = currentResult.accumulatedDepreciation;
          row[`Q${q} NBV`] = currentResult.netBookValue;
        }

        excelData.push(row);
      });

      const catTotals = categoryTotals.find(c => c.name === group.name);
      if (catTotals) {
        const subtotal: Record<string, unknown> = {
          'QTY': '',
          'UNIT': '',
          'PARTICULARS': `Subtotal: ${group.name}`,
          'Date': '',
          'COST': catTotals.totalCost,
          'VAT': catTotals.totalVat,
          'AMOUNT': catTotals.totalAmount,
          'USEFUL LIFE': '',
          'MONTHLY DEP': '',
        };

        for (let q = 1; q <= 4; q++) {
          subtotal[`Q${q} DEP`] = catTotals.quarterlyData[q - 1]?.dep;
          subtotal[`Q${q} ACCUM`] = catTotals.quarterlyData[q - 1]?.accum;
          subtotal[`Q${q} NBV`] = catTotals.quarterlyData[q - 1]?.nbv;
        }
        excelData.push(subtotal);
      }
    });

    const grandTotalRow: Record<string, unknown> = {
      'QTY': '',
      'UNIT': '',
      'PARTICULARS': 'GRAND TOTAL',
      'Date': '',
      'COST': grandTotals.totalCost,
      'VAT': grandTotals.totalVat,
      'AMOUNT': grandTotals.totalAmount,
      'USEFUL LIFE': '',
      'MONTHLY DEP': '',
    };

    for (let q = 1; q <= 4; q++) {
      const qData = [grandTotals.q1, grandTotals.q2, grandTotals.q3, grandTotals.q4][q - 1];
      grandTotalRow[`Q${q} DEP`] = qData.dep;
      grandTotalRow[`Q${q} ACCUM`] = qData.accum;
      grandTotalRow[`Q${q} NBV`] = qData.nbv;
    }
    excelData.push(grandTotalRow);

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PPE Schedule');

    const colWidths = [
      { wch: 8 },
      { wch: 8 },
      { wch: 35 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `PPE_Schedule_${selectedYear}.xlsx`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PPE Schedule Report</h1>
          <p className="text-muted-foreground">Property, Plant and Equipment Schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead rowSpan={2} className="text-center align-middle w-12">QTY</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-12">UNIT</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle">PARTICULARS</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-24">Date</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle">COST</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle">VAT</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle">AMOUNT</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-20">USEFUL LIFE</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle w-20">MONTHLY DEP</TableHead>
                <TableColGroup>Quarter</TableColGroup>
              </TableRow>
              <TableRow className="bg-muted">
                <TableHead colSpan={3} className="text-center">Q1</TableHead>
                <TableHead colSpan={3} className="text-center">Q2</TableHead>
                <TableHead colSpan={3} className="text-center">Q3</TableHead>
                <TableHead colSpan={3} className="text-center">Q4</TableHead>
              </TableRow>
              <TableRow className="bg-muted">
                {[1, 2, 3, 4].map(q =>
                  ['DEP', 'ACCUM', 'NBV'].map((label, i) => (
                    <TableHead key={`${q}-${label}`} className="text-right">
                      {label}
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryTotals.map((category, idx) => (
                <>
                  <TableRow key={`cat-${idx}`} className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>
                      {category.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(category.totalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(category.totalVat)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(category.totalAmount)}
                    </TableCell>
                    <TableCell colSpan={3} />
                    {category.quarterlyData.map(qd => (
                      <TableCell key={qd.quarter} colSpan={3} className="hidden" />
                    ))}
                  </TableRow>
                  {groupedAssets[idx].assets.map(asset => {
                    const cost = asset.purchaseCost * (asset.quantity || 1);
                    const vat = cost * 0.12;
                    const amount = cost + vat;
                    const qd = category.quarterlyData;

                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="text-center">{asset.quantity || 1}</TableCell>
                        <TableCell className="text-center">unit</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell className="text-center">
                          {new Date(asset.purchaseDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(vat)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        <TableCell className="text-center">{asset.usefulLife} yrs</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        {qd.map(q => (
                          <TableCell key={q.quarter} className="hidden" />
                        ))}
                      </TableRow>
                    );
                  })}
                  <TableRow key={`sub-${idx}`} className="font-bold bg-muted">
                    <TableCell colSpan={4}>Subtotal: {category.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.totalCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.totalVat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(category.totalAmount)}</TableCell>
                    <TableCell colSpan={3} />
                    {category.quarterlyData.map(qd => (
                      <>
                        <TableCell key={`${qd.quarter}-dep`} className="text-right">
                          {formatCurrency(qd.dep)}
                        </TableCell>
                        <TableCell key={`${qd.quarter}-accum`} className="text-right">
                          {formatCurrency(qd.accum)}
                        </TableCell>
                        <TableCell key={`${qd.quarter}-nbv`} className="text-right">
                          {formatCurrency(qd.nbv)}
                        </TableCell>
                      </>
                    ))}
                  </TableRow>
                </>
              ))}
              <TableRow className="font-bold bg-primary text-primary-foreground">
                <TableCell colSpan={4}>GRAND TOTAL</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotals.totalCost)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotals.totalVat)}</TableCell>
                <TableCell className="text-right">{formatCurrency(grandTotals.totalAmount)}</TableCell>
                <TableCell colSpan={3} />
                {[grandTotals.q1, grandTotals.q2, grandTotals.q3, grandTotals.q4].map((q, i) => (
                  <>
                    <TableCell key={`gt-${i}-dep`} className="text-right">
                      {formatCurrency(q.dep)}
                    </TableCell>
                    <TableCell key={`gt-${i}-accum`} className="text-right">
                      {formatCurrency(q.accum)}
                    </TableCell>
                    <TableCell key={`gt-${i}-nbv`} className="text-right">
                      {formatCurrency(q.nbv)}
                    </TableCell>
                  </>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TableColGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}