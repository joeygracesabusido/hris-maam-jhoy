/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Trash2 } from 'lucide-react';

export default function PurchasesPage() {
  const [bills, setBills] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [accounts, setAccounts] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    supplierId: '',
    supplierName: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    expenseAccountId: '',
    apAccountId: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
    totalAmount: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [billsRes, accRes] = await Promise.all([
        fetch('/api/accounting/purchases'),
        fetch('/api/accounting/accounts'),
      ]);
      setBills(await billsRes.json());
      setAccounts(await accRes.json());
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  }

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
      const res = await fetch('/api/accounting/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsDialogOpen(false);
        setFormData({
          supplierId: '', supplierName: '', date: new Date().toISOString().split('T')[0],
          dueDate: new Date().toISOString().split('T')[0], expenseAccountId: '', apAccountId: '',
          items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }], totalAmount: 0,
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create bill');
      }
    } catch (err) {
      console.error('Error creating bill:', err);
    }
  }

  const filteredBills = bills.filter(bill =>
    bill.supplierName.toLowerCase().includes(search.toLowerCase()) ||
    bill.billNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Purchase Bills</h1>
          <p className="text-muted-foreground">Manage supplier bills and accounts payable</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2"><Plus className="w-4 h-4" /> New Bill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader><DialogTitle>Create Purchase Bill</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Supplier ID</Label>
                  <Input value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})} required />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Supplier Name</Label>
                  <Input value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bill Date</Label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <Input type="number" value={formData.totalAmount} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expense Account (Debit)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.expenseAccountId} onChange={e => setFormData({...formData, expenseAccountId: e.target.value})} required>
                    <option value="">Select Expense Account...</option>
                    {accounts.filter(a => a.type === 'EXPENSE').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>AP Account (Credit)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.apAccountId} onChange={e => setFormData({...formData, apAccountId: e.target.value})} required>
                    <option value="">Select AP Account...</option>
                    {accounts.filter(a => a.type === 'LIABILITY').map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-2"><Plus className="w-3 h-3" /> Add Item</Button>
                </div>
                <Table className="border rounded-lg">
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Description</TableHead>
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
                        <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={formData.items.length <= 1}><Trash2 className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter><Button type="submit">Create Bill</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle>Bill History</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search suppliers or bills..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow> :
               filteredBills.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No bills found.</TableCell></TableRow> :
               filteredBills.map(bill => (
                 <TableRow key={bill.id}>
                   <TableCell className="font-mono">{bill.billNumber}</TableCell>
                   <TableCell>{bill.supplierName}</TableCell>
                   <TableCell>{new Date(bill.date).toLocaleDateString()}</TableCell>
                   <TableCell>{new Date(bill.dueDate).toLocaleDateString()}</TableCell>
                   <TableCell className="text-right font-medium">₱{bill.totalAmount.toLocaleString()}</TableCell>
                   <TableCell><span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">{bill.status}</span></TableCell>
                 </TableRow>
               ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
