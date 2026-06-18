'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';
import { useAssetTransactions } from '@/hooks/use-assets';

export default function AssetTransactionsPage() {
  const { selectedBranch } = useBranch();
  const params = selectedBranch ? { branchId: selectedBranch.id } : undefined;
  const { data: rawTransactions, isLoading: loading } = useAssetTransactions(params);
  const transactions = (rawTransactions || []) as any[];

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'ACQUISITION': return <Badge className="bg-blue-500">Acquisition</Badge>;
      case 'TRANSFER': return <Badge className="bg-purple-500">Transfer</Badge>;
      case 'MAINTENANCE': return <Badge className="bg-orange-500">Maintenance</Badge>;
      case 'DISPOSAL': return <Badge variant="destructive">Disposal</Badge>;
      case 'DEPRECIATION': return <Badge variant="secondary">Depreciation</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Asset Transactions Audit Trail</h1>
        <BranchSelector />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Cost/Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">No transactions recorded.</TableCell>
                  </TableRow>
                ) : (
                  transactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap">{new Date(txn.date).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{txn.asset?.assetCode || '-'}</TableCell>
                      <TableCell className="font-medium">{txn.asset?.name || '-'}</TableCell>
                      <TableCell>{getTypeBadge(txn.type)}</TableCell>
                      <TableCell className="max-w-xs truncate">{txn.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        {txn.cost ? `₱${txn.cost.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
