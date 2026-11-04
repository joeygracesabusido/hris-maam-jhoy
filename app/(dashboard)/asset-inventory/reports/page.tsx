'use client';

import { useState, useMemo } from 'react';
import { FileDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateDepreciation } from '@/lib/depreciation';
import * as XLSX from 'xlsx';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';
import { useAssets } from '@/hooks/use-assets';



interface CombinedAsset {
  name: string;
  purchaseDate: string;
  quantity: number;
  purchaseCost: number;
  residualValue: number;
  usefulLife: number;
  depreciationMethod: string;
  assetCodes: string[];
  status: string;
}

interface CategoryGroup {
  name: string;
  assets: CombinedAsset[];
}

interface QuarterlyData {
  quarter: number;
  dep: number;
  accum: number;
  nbv: number;
}

interface ComplianceIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  assetCode?: string;
  assetName?: string;
}

function getQuarterDate(year: number, quarter: number): Date {
  const monthOffset = (quarter - 1) * 3;
  return new Date(year, monthOffset + 2, 31);
}

function checkCompliance(assets: CombinedAsset[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  assets.forEach(asset => {
    // Check for zero useful life on non-Land assets
    if (asset.usefulLife <= 0 && asset.depreciationMethod !== 'NONE') {
      issues.push({
        severity: 'error',
        message: `Asset has 0 useful life but depreciation method is not 'None' (should be Land or have useful life > 0)`,
        assetCode: asset.assetCodes[0],
        assetName: asset.name,
      });
    }
    
    // Check for missing residual value on depreciable assets
    if (asset.usefulLife > 0 && asset.residualValue === 0 && asset.purchaseCost > 0) {
      issues.push({
        severity: 'warning',
        message: `Depreciable asset has zero residual value - consider setting a residual value per IAS 16`,
        assetCode: asset.assetCodes[0],
        assetName: asset.name,
      });
    }
    
    // Check for declining balance without proper rate disclosure
    if (asset.depreciationMethod === 'DECLINING_BALANCE' && asset.usefulLife > 0) {
      issues.push({
        severity: 'info',
        message: `Declining balance method used - ensure 2x straight-line rate is appropriate per PFRS`,
        assetCode: asset.assetCodes[0],
        assetName: asset.name,
      });
    }
    
    // Check for assets fully depreciated but still active
    if (asset.usefulLife > 0) {
      const result = calculateDepreciation({
        purchaseCost: asset.purchaseCost,
        residualValue: asset.residualValue,
        usefulLife: asset.usefulLife,
        purchaseDate: new Date(asset.purchaseDate),
        method: asset.depreciationMethod,
        asOfDate: new Date(),
      });
      if (result.netBookValue <= asset.residualValue && asset.status === 'ACTIVE') {
        issues.push({
          severity: 'info',
          message: `Asset appears fully depreciated but status is Active - consider disposal or revaluation`,
          assetCode: asset.assetCodes[0],
          assetName: asset.name,
        });
      }
    }
  });
  
  return issues;
}

export default function PPEReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const { selectedBranch } = useBranch();
  const params: Record<string, string> = { status: 'ACTIVE' };
  if (selectedBranch) {
    params.branchId = selectedBranch.id;
  }
  const { data: rawAssets, isLoading: loading } = useAssets(params);
  const assets = (rawAssets || []) as any[];

  const groupedAssets = useMemo((): CategoryGroup[] => {
    const groups: Record<string, Record<string, CombinedAsset>> = {};
    
    assets.forEach(asset => {
      const categoryName = asset.category?.name || 'UNCATEGORIZED';
      const key = `${asset.name}|${asset.purchaseDate}`;
      
      if (!groups[categoryName]) {
        groups[categoryName] = {};
      }
      
      if (!groups[categoryName][key]) {
        groups[categoryName][key] = {
          name: asset.name,
          purchaseDate: asset.purchaseDate,
          quantity: 0,
          purchaseCost: 0,
          residualValue: 0,
          usefulLife: categoryName.toUpperCase() === 'LAND' ? 0 : asset.usefulLife,
          depreciationMethod: categoryName.toUpperCase() === 'LAND' ? 'NONE' : asset.depreciationMethod,
          assetCodes: [],
          status: asset.status,
        };
      }
      
      groups[categoryName][key].quantity += (asset.quantity || 1);
      groups[categoryName][key].purchaseCost += asset.purchaseCost;
      groups[categoryName][key].residualValue += asset.residualValue;
      groups[categoryName][key].assetCodes.push(asset.assetCode);
    });

    return Object.entries(groups)
      .map(([categoryName, combinedMap]) => ({
        name: categoryName,
        assets: Object.values(combinedMap).sort((a, b) => 
          new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  const categoryTotals = useMemo(() => {
    return groupedAssets.map(group => {
      let totalAmount = 0;
      const quarterlyData: QuarterlyData[] = [];

      group.assets.forEach(asset => {
        const amount = asset.purchaseCost;
        totalAmount += amount;
      });

      for (let q = 1; q <= 4; q++) {
        const asOfDate = getQuarterDate(selectedYear, q);
        let quarterDep = 0;
        let quarterAccum = 0;
        let quarterNbv = 0;

        group.assets.forEach(asset => {
          const prevAsOfDate = getQuarterDate(selectedYear, q - 1);
          
          const prevResult = calculateDepreciation({
            purchaseCost: asset.purchaseCost,
            residualValue: asset.residualValue,
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: prevAsOfDate,
          });

          const currentResult = calculateDepreciation({
            purchaseCost: asset.purchaseCost,
            residualValue: asset.residualValue,
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
        totalAmount,
        quarterlyData,
      };
    });
  }, [groupedAssets, selectedYear]);

  const grandTotals = useMemo(() => {
    return categoryTotals.reduce(
      (acc, cat) => ({
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
        const amount = asset.purchaseCost;

        const row: Record<string, unknown> = {
          'QTY': asset.quantity || 1,
          'UNIT': 'unit',
          'PARTICULARS': asset.name,
          'Date': asset.purchaseDate,
          'AMOUNT': amount,
          'USEFUL LIFE': asset.usefulLife,
          'MONTHLY DEP': 0,
        };

        for (let q = 1; q <= 4; q++) {
          const asOfDate = getQuarterDate(selectedYear, q);
          const prevAsOfDate = getQuarterDate(selectedYear, q - 1);

          const prevResult = calculateDepreciation({
            purchaseCost: amount,
            residualValue: asset.residualValue,
            usefulLife: asset.usefulLife,
            purchaseDate: new Date(asset.purchaseDate),
            method: asset.depreciationMethod,
            asOfDate: prevAsOfDate,
          });

          const currentResult = calculateDepreciation({
            purchaseCost: amount,
            residualValue: asset.residualValue,
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

    // Create Quarterly Depreciation Summary sheet
    const quarterlySummaryData: Record<string, unknown>[] = [];
    categoryTotals.forEach(category => {
      const row: Record<string, unknown> = {
        'Category': category.name,
        'Q1 Dep': category.quarterlyData[0]?.dep ?? 0,
        'Q2 Dep': category.quarterlyData[1]?.dep ?? 0,
        'Q3 Dep': category.quarterlyData[2]?.dep ?? 0,
        'Q4 Dep': category.quarterlyData[3]?.dep ?? 0,
        'Annual Dep': category.quarterlyData.reduce((sum, q) => sum + q.dep, 0),
        'Accum. Dep (YE)': category.quarterlyData[3]?.accum ?? 0,
        'NBV (YE)': category.quarterlyData[3]?.nbv ?? 0,
      };
      quarterlySummaryData.push(row);
    });
    
    // Grand total row for quarterly summary
    quarterlySummaryData.push({
      'Category': 'GRAND TOTAL',
      'Q1 Dep': grandTotals.q1.dep,
      'Q2 Dep': grandTotals.q2.dep,
      'Q3 Dep': grandTotals.q3.dep,
      'Q4 Dep': grandTotals.q4.dep,
      'Annual Dep': grandTotals.q1.dep + grandTotals.q2.dep + grandTotals.q3.dep + grandTotals.q4.dep,
      'Accum. Dep (YE)': grandTotals.q4.accum,
      'NBV (YE)': grandTotals.q4.nbv,
    });

    // Create Compliance Issues sheet
    const complianceData: Record<string, unknown>[] = [];
    complianceIssues.forEach(issue => {
      complianceData.push({
        'Severity': issue.severity.toUpperCase(),
        'Message': issue.message,
        'Asset Code': issue.assetCode || '',
        'Asset Name': issue.assetName || '',
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const quarterlyWorksheet = XLSX.utils.json_to_sheet(quarterlySummaryData);
    const complianceWorksheet = XLSX.utils.json_to_sheet(complianceData);
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PPE Schedule');
    XLSX.utils.book_append_sheet(workbook, quarterlyWorksheet, 'Quarterly Dep Summary');
    if (complianceData.length > 0) {
      XLSX.utils.book_append_sheet(workbook, complianceWorksheet, 'Compliance Issues');
    }

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
    ];
    worksheet['!cols'] = colWidths;

    const quarterlyColWidths = [
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
    ];
    quarterlyWorksheet['!cols'] = quarterlyColWidths;

    const complianceColWidths = [
      { wch: 12 },
      { wch: 60 },
      { wch: 15 },
      { wch: 30 },
    ];
    complianceWorksheet['!cols'] = complianceColWidths;

    XLSX.writeFile(workbook, `PPE_Schedule_${selectedYear}.xlsx`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);
  };

  // Flatten all combined assets for compliance checking
  const allCombinedAssets = useMemo(() => 
    groupedAssets.flatMap(g => g.assets), [groupedAssets]);
  
  const complianceIssues = useMemo(() => checkCompliance(allCombinedAssets), [allCombinedAssets]);

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
          <BranchSelector />
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

      {/* Compliance Issues Card */}
      {complianceIssues.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              PFRS/IAS 16 Compliance Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {complianceIssues.map((issue, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start gap-2 p-3 rounded-lg border ${
                    issue.severity === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    issue.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  {issue.severity === 'error' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  {issue.severity === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  {issue.severity === 'info' && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />}
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{issue.message}</p>
                    {issue.assetCode && (
                      <p className="text-xs mt-1 font-mono">{issue.assetCode} - {issue.assetName}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quarterly Depreciation Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Depreciation Summary - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="text-center w-32">Category</TableHead>
                  <TableHead className="text-right">Q1 Dep</TableHead>
                  <TableHead className="text-right">Q2 Dep</TableHead>
                  <TableHead className="text-right">Q3 Dep</TableHead>
                  <TableHead className="text-right">Q4 Dep</TableHead>
                  <TableHead className="text-right">Annual Dep</TableHead>
                  <TableHead className="text-right">Accum. Dep (YE)</TableHead>
                  <TableHead className="text-right">NBV (YE)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryTotals.map((category, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    {category.quarterlyData.map(qd => (
                      <TableCell key={qd.quarter} className="text-right font-mono">
                        {formatCurrency(qd.dep)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold font-mono">
                      {formatCurrency(category.quarterlyData.reduce((sum, q) => sum + q.dep, 0))}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(category.quarterlyData[3]?.accum ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(category.quarterlyData[3]?.nbv ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-primary text-primary-foreground">
                  <TableCell>GRAND TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(grandTotals.q1.dep)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(grandTotals.q2.dep)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(grandTotals.q3.dep)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(grandTotals.q4.dep)}</TableCell>
                  <TableCell className="text-right font-bold font-mono">
                    {formatCurrency(grandTotals.q1.dep + grandTotals.q2.dep + grandTotals.q3.dep + grandTotals.q4.dep)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(grandTotals.q4.accum)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(grandTotals.q4.nbv)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed PPE Schedule Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed PPE Schedule</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead rowSpan={2} className="text-center align-middle w-12">QTY</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-12">UNIT</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle">PARTICULARS</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-24">Date</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle">AMOUNT</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle w-20">USEFUL LIFE</TableHead>
                <TableHead rowSpan={2} className="text-right align-middle w-20">MONTHLY DEP</TableHead>
                <TableHead colSpan={3} className="text-center align-middle">Q1</TableHead>
                <TableHead colSpan={3} className="text-center align-middle">Q2</TableHead>
                <TableHead colSpan={3} className="text-center align-middle">Q3</TableHead>
                <TableHead colSpan={3} className="text-center align-middle">Q4</TableHead>
              </TableRow>
              <TableRow className="bg-muted">
                {[1, 2, 3, 4].map(q =>
                  ['DEP', 'ACCUM', 'NBV'].map((label) => (
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
                      {formatCurrency(category.totalAmount)}
                    </TableCell>
                    <TableCell colSpan={3} />
                    {category.quarterlyData.map(qd => (
                      <>
                        <TableCell className="text-right">{formatCurrency(qd.dep)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(qd.accum)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(qd.nbv)}</TableCell>
                      </>
                    ))}
                  </TableRow>
                  {groupedAssets[idx].assets.map((asset, assetIdx) => {
                    const amount = asset.purchaseCost; // Total amount

                    const assetQuarterlyData = [1, 2, 3, 4].map(q => {
                      const asOfDate = getQuarterDate(selectedYear, q);
                      const prevAsOfDate = getQuarterDate(selectedYear, q - 1);
                      const prevResult = calculateDepreciation({
                        purchaseCost: amount,
                        residualValue: asset.residualValue,
                        usefulLife: asset.usefulLife,
                        purchaseDate: new Date(asset.purchaseDate),
                        method: asset.depreciationMethod,
                        asOfDate: prevAsOfDate,
                      });
                      const currentResult = calculateDepreciation({
                        purchaseCost: amount,
                        residualValue: asset.residualValue,
                        usefulLife: asset.usefulLife,
                        purchaseDate: new Date(asset.purchaseDate),
                        method: asset.depreciationMethod,
                        asOfDate: asOfDate,
                      });
                      return {
                        dep: currentResult.accumulatedDepreciation - prevResult.accumulatedDepreciation,
                        accum: currentResult.accumulatedDepreciation,
                        nbv: currentResult.netBookValue,
                      };
                    });

                    return (
                      <TableRow key={`${asset.name}-${asset.purchaseDate}-${assetIdx}`}>
                        <TableCell className="text-center">{asset.quantity}</TableCell>
                        <TableCell className="text-center">unit</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell className="text-center">
                          {new Date(asset.purchaseDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        <TableCell className="text-center">{asset.usefulLife} yrs</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        {assetQuarterlyData.map((q, i) => (
                          <>
                            <TableCell key={`q${i+1}-dep`} className="text-right">{formatCurrency(q.dep)}</TableCell>
                            <TableCell key={`q${i+1}-accum`} className="text-right">{formatCurrency(q.accum)}</TableCell>
                            <TableCell key={`q${i+1}-nbv`} className="text-right">{formatCurrency(q.nbv)}</TableCell>
                          </>
                        ))}
                      </TableRow>
                    );
                  })}
                  <TableRow key={`sub-${idx}`} className="font-bold bg-muted">
                    <TableCell colSpan={4}>Subtotal: {category.name}</TableCell>
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