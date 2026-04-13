'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { calculateDepreciation } from '@/lib/depreciation';

export default function AssetListPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => {
        setAssets(data || []);
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ACTIVE': return <Badge className="bg-green-500">Active</Badge>;
      case 'DISPOSED': return <Badge variant="destructive">Disposed</Badge>;
      case 'UNDER_MAINTENANCE': return <Badge className="bg-orange-500">Maintenance</Badge>;
      case 'INACTIVE': return <Badge variant="secondary">Inactive</Badge>;
      case 'LOST': return <Badge variant="destructive">Lost</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(search.toLowerCase()) || 
    asset.assetCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Asset Inventory</h1>
        <Button onClick={() => router.push('/asset-inventory/new')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Asset
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>All Assets</CardTitle>
          <div className="w-72">
            <Input 
              placeholder="Search by name or code..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Net Book Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                  </TableRow>
                ) : filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">No assets found.</TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map(asset => {
                    const { netBookValue } = calculateDepreciation({
                      purchaseCost: asset.purchaseCost,
                      residualValue: asset.residualValue,
                      usefulLife: asset.usefulLife,
                      purchaseDate: new Date(asset.purchaseDate),
                      method: asset.depreciationMethod
                    });

                    return (
                      <TableRow key={asset.id}>
                        <TableCell className="font-mono text-sm">{asset.assetCode}</TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>{asset.category?.name || '-'}</TableCell>
                        <TableCell>{asset.quantity || 1}</TableCell>
                        <TableCell>{asset.location}</TableCell>
                        <TableCell className="text-right">₱{asset.purchaseCost.toLocaleString()}</TableCell>
                        <TableCell className="text-right">₱{netBookValue.toLocaleString()}</TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/asset-inventory/${asset.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
