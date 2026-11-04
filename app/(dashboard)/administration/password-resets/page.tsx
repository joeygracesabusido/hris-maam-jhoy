'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, X, Check, Loader2, AlertCircle, Clock, User, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface PasswordResetRequest {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'COMPLETED';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  resetCode?: string;
  codeExpiresAt?: string;
  completedAt?: string;
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    role: string;
  };
  reviewer?: {
    id: string;
    name: string;
    username: string;
  };
}

export default function PasswordResetsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [generateCodeFor, setGenerateCodeFor] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['password-resets', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/password-resets?${params}`);
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/admin/password-resets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', notes }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-resets'] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/admin/password-resets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DENY', notes }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-resets'] });
    },
  });

  const generateCodeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/password-resets/${id}/generate-code`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-resets'] });
      setShowCodeDialog(false);
      setGenerateCodeFor(null);
    },
  });

  const handleApprove = (request: PasswordResetRequest) => {
    setSelectedRequest(request);
    setNotes('');
    setShowCodeDialog(true);
  };

  const handleDeny = (request: PasswordResetRequest) => {
    setSelectedRequest(request);
    setNotes('');
    setShowCodeDialog(true);
  };

  const confirmAction = async (action: 'APPROVE' | 'DENY') => {
    if (!selectedRequest) return;
    
    if (action === 'DENY' && !notes.trim()) {
      alert('Reason for denial is required');
      return;
    }

    try {
      if (action === 'APPROVE') {
        await approveMutation.mutateAsync({ id: selectedRequest.id, notes });
      } else {
        await denyMutation.mutateAsync({ id: selectedRequest.id, notes });
      }
      setShowCodeDialog(false);
      setSelectedRequest(null);
      setNotes('');
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  const handleGenerateCode = (request: PasswordResetRequest) => {
    setGenerateCodeFor(request.id);
    setShowCodeDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const config = {
      PENDING: { icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
      APPROVED: { icon: Check, color: 'bg-green-100 text-green-700' },
      DENIED: { icon: X, color: 'bg-red-100 text-red-700' },
      COMPLETED: { icon: Check, color: 'bg-blue-100 text-blue-700' },
    };
    const { icon: Icon, color } = config[status as keyof typeof config] || config.PENDING;
    return (
      <Badge className={`${color} gap-1`}>
        <Icon className="w-3 h-3" /> {status}
      </Badge>
    );
  };

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Password Reset Requests</h1>
          <p className="text-muted-foreground">Manage user password reset requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        {['ALL', 'PENDING', 'APPROVED', 'DENIED', 'COMPLETED'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {status} ({data?.requests?.filter((r: PasswordResetRequest) => r.status === status).length || 0})
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : data?.requests?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No requests found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead className="px-6 py-3">User</TableHead>
                  <TableHead className="px-6 py-3">Requested</TableHead>
                  <TableHead className="px-6 py-3">Status</TableHead>
                  <TableHead className="px-6 py-3">Reviewed By</TableHead>
                  <TableHead className="px-6 py-3">Reset Code</TableHead>
                  <TableHead className="px-6 py-3">Code Expires</TableHead>
                  <TableHead className="px-6 py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.requests?.map((request: PasswordResetRequest) => (
                  <TableRow key={request.id} className="hover:bg-muted/50">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{request.user.name || request.user.username}</p>
                          <p className="text-sm text-muted-foreground">@{request.user.username} &bull; {request.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm">
                      {format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="px-6 py-4">{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="px-6 py-4 text-sm">
                      {request.reviewedAt ? (
                        <>
                          {request.reviewer?.name || 'Unknown'}
                          <br />
                          {format(new Date(request.reviewedAt), 'MMM dd, yyyy HH:mm')}
                        </>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {request.resetCode ? (
                        <code className="font-mono bg-muted px-2 py-1 rounded">{request.resetCode}</code>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm">
                      {request.codeExpiresAt ? (
                        format(new Date(request.codeExpiresAt), 'MMM dd, yyyy HH:mm')
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex gap-2">
                        {request.status === 'PENDING' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(request)}
                              disabled={approveMutation.isPending}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <Check className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeny(request)}
                              disabled={denyMutation.isPending}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <X className="w-3 h-3 mr-1" /> Deny
                            </Button>
                          </>
                        )}
                        {request.status === 'APPROVED' && !request.resetCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateCode(request)}
                            disabled={generateCodeMutation.isPending}
                          >
                            <Key className="w-3 h-3 mr-1" /> Generate Code
                          </Button>
                        )}
                        {request.status === 'APPROVED' && request.resetCode && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                            Code Generated
                          </span>
                        )}
                        {request.reviewNotes && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground" title={request.reviewNotes}>
                            <AlertCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === 'PENDING' 
                ? (generateCodeFor ? 'Generate Reset Code' : (notes !== undefined && notes !== '' ? 'Deny Request' : 'Approve Request'))
                : 'Action'}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                User: <strong>{selectedRequest.user.name || selectedRequest.user.username}</strong> ({selectedRequest.user.email})
              </p>
              {selectedRequest.status === 'PENDING' && !generateCodeFor && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {notes ? 'Enter reason for denial (required):' : 'Optional notes for approval:'}
                  </p>
                  <div className="space-y-4 py-2">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Notes</label>
                      <Input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter notes..."
                        className="w-full"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setShowCodeDialog(false); setSelectedRequest(null); setNotes(''); }}>Cancel</Button>
                    {notes ? (
                      <Button variant="destructive" onClick={() => confirmAction('DENY')} disabled={denyMutation.isPending}>
                        {denyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />} Deny Request
                      </Button>
                    ) : (
                      <Button onClick={() => confirmAction('APPROVE')} disabled={approveMutation.isPending}>
                        {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Approve Request
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
              {generateCodeFor && (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    A 6-character reset code will be generated. Provide this code to the user securely.
                    The code expires in 24 hours.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setShowCodeDialog(false); setGenerateCodeFor(null); }}>Cancel</Button>
                    <Button onClick={() => generateCodeMutation.mutate(generateCodeFor!)} disabled={generateCodeMutation.isPending}>
                      {generateCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Key className="w-4 h-4 mr-2" />} Generate Code
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}