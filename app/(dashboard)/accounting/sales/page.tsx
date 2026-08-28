/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useBranch } from '@/lib/branch-context';
import { BranchSelector } from '@/components/branch-selector';
import { useSales, useAccounts, useCreateSale } from '@/hooks/use-accounting';

export default function SalesPage() {
  const { selectedBranch, branches } = useBranch();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    arAccountId: '',
    revenueAccountId: '',
    branchId: '',
    isAcknowledgementReceipt: false,
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
    totalAmount: 0,
  });

  const params: Record<string, string> = {};
  if (selectedBranch) params.branchId = selectedBranch.id;
  const { data: _invoices, isLoading: loading } = useSales(params);
  const invoices = (_invoices as any[]) || [];
  const { data: accounts = [] } = useAccounts();
  const createSale = useCreateSale();

  useEffect(() => {
    if (isDialogOpen && selectedBranch) {
      setFormData(prev => ({ ...prev, branchId: selectedBranch.id }));
    }
  }, [isDialogOpen, selectedBranch]);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unitPrice: 0, total: 0 }],
    });
  };

  const updateItem = (index: number, field: string, value: unknown) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }

    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalAmount: newTotal });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, totalAmount: newTotal });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSale.mutateAsync({ ...formData, branchId: formData.branchId || selectedBranch?.id || '' });
      setIsDialogOpen(false);
      setFormData({
        customerId: '', customerName: '', date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0], arAccountId: '', revenueAccountId: '',
        branchId: selectedBranch?.id || '',
        isAcknowledgementReceipt: false,
        items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }], totalAmount: 0,
      });
    } catch (err) {
      console.error('Error creating invoice:', err);
    }
  }

  const filteredInvoices = invoices.filter(inv =>
    inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sales Invoices</h1>
            <p className="text-muted-foreground">Manage customer billing and accounts receivable</p>
          </div>
          <div className="flex items-center gap-4">
          <BranchSelector />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Invoice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto flex flex-col p-0 gap-0">
            <DialogHeader className="sticky top-0 z-10 bg-background px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle>{formData.isAcknowledgementReceipt ? 'Create Acknowledgement Receipt' : 'Create Sales Invoice'}</DialogTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">{formData.isAcknowledgementReceipt ? 'AR-only: acknowledges payment without BIR sales recognition' : 'Standard BIR-recognized sales invoice'}</p>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 sm:space-y-6">
              <label className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isAcknowledgementReceipt}
                  onChange={e => setFormData({ ...formData, isAcknowledgementReceipt: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium leading-none">Acknowledgement Receipt only</div>
                  <div className="text-xs text-muted-foreground mt-1">Check if this is an AR (non-BIR) receipt — revenue will not be recognized until converted. Invoice will be numbered as AR-YYYY-XXXX.</div>
                </div>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Customer ID</Label>
                  <Input value={formData.customerId} onChange={e => setFormData({...formData, customerId: e.target.value})} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Customer Name</Label>
                  <Input value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input type="number" value={formData.totalAmount} readOnly className="bg-muted" />
                </div>
              </div>
              {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input value={branches.find(b => b.id === formData.branchId)?.name || ''} disabled />
              </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>AR Account (Debit)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.arAccountId} onChange={e => setFormData({...formData, arAccountId: e.target.value})} required>
                    <option value="">Select AR Account...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">Revenue Account (Credit) {formData.isAcknowledgementReceipt && <span className="text-xs font-normal text-amber-600">(optional for AR)</span>}</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                    value={formData.revenueAccountId} onChange={e => setFormData({...formData, revenueAccountId: e.target.value})} required={!formData.isAcknowledgementReceipt} disabled={formData.isAcknowledgementReceipt && false}>
                    <option value="">{formData.isAcknowledgementReceipt ? 'Optional — leave empty for AR-only' : 'Select Revenue Account...'}</option>
                    {accounts.filter(a => a.type === 'REVENUE').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                  {formData.isAcknowledgementReceipt && !formData.revenueAccountId && (
                    <p className="text-xs text-amber-600">AR-only: no revenue will be posted (balanced AR debit/credit memo entry).</p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-2 self-start sm:self-auto"><Plus className="w-3 h-3" /> Add Item</Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                <Table className="min-w-[560px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-32">Price</TableHead>
                      <TableHead className="w-32">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} required /></TableCell>
                        <TableCell><Input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} required /></TableCell>
                        <TableCell><Input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} required /></TableCell>
                        <TableCell className="text-right font-medium">₱{item.total.toFixed(2)}</TableCell>
                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={formData.items.length <= 1}><Trash2 className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            </form>
            <div className="sticky bottom-0 bg-background px-6 py-4 border-t shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" onClick={handleSubmit as any}>{formData.isAcknowledgementReceipt ? 'Create Receipt (AR)' : 'Create Invoice'}</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Invoice History</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search customers or invoices..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow> :
                filteredInvoices.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No invoices found.</TableCell></TableRow> :
                filteredInvoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono">{inv.invoiceNumber}</TableCell>
                    <TableCell>{(inv as any).isAcknowledgementReceipt ? <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-200">AR</span> : <span className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-800">INV</span>}</TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">₱{inv.totalAmount.toLocaleString()}</TableCell>
                    <TableCell><span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">{inv.status}</span></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
