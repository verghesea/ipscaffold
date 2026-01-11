import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeaders } from '@/lib/api';
import { Users, FileText, CreditCard, TrendingUp, Shield, ArrowLeft, Gift, Plus, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SystemMetrics {
  total_users: number;
  total_patents: number;
  patents_today: number;
  total_credits_used: number;
  status_breakdown: Array<{ status: string; count: number }>;
}

interface User {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  created_at: string;
}

interface Patent {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  created_at: string;
}

interface PromoCode {
  id: string;
  code: string;
  credit_amount: number;
  max_redemptions: number | null;
  current_redemptions: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoCredits, setNewPromoCredits] = useState('');
  const [newPromoMaxRedemptions, setNewPromoMaxRedemptions] = useState('');

  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/metrics', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: User[] }>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const { data: patentsData, isLoading: patentsLoading } = useQuery<{ patents: Patent[] }>({
    queryKey: ['admin-patents'],
    queryFn: async () => {
      const res = await fetch('/api/admin/patents', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch patents');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const { data: promoCodesData, isLoading: promoCodesLoading } = useQuery<PromoCode[]>({
    queryKey: ['admin-promo-codes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promo-codes', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch promo codes');
      return res.json();
    },
    enabled: !!profile?.is_admin,
  });

  const createPromoCodeMutation = useMutation({
    mutationFn: async ({ code, creditAmount, maxRedemptions }: { code: string; creditAmount: number; maxRedemptions: number | null }) => {
      const res = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, creditAmount, maxRedemptions }),
      });
      if (!res.ok) throw new Error('Failed to create promo code');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
      setPromoDialogOpen(false);
      setNewPromoCode('');
      setNewPromoCredits('');
      setNewPromoMaxRedemptions('');
    },
  });

  const togglePromoCodeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to update promo code');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promo-codes'] });
    },
  });

  const adjustCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount, description }: { userId: string; amount: number; description: string }) => {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description }),
      });
      if (!res.ok) throw new Error('Failed to adjust credits');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedUser(null);
      setCreditAmount('');
      setCreditDescription('');
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) throw new Error('Failed to update admin status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold font-playfair mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">You don't have administrator privileges.</p>
            <Button onClick={() => navigate('/dashboard')} data-testid="button-back-dashboard">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-playfair">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage users and monitor system</p>
            </div>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            <Shield className="w-3 h-3 mr-1" />
            Administrator
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card data-testid="card-metric-users">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{metrics?.total_users || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-patents">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Patents</p>
                  <p className="text-2xl font-bold">{metrics?.total_patents || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-today">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Patents Today</p>
                  <p className="text-2xl font-bold">{metrics?.patents_today || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-credits">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <CreditCard className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credits Used</p>
                  <p className="text-2xl font-bold">{metrics?.total_credits_used || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {metrics?.status_breakdown && metrics.status_breakdown.length > 0 && (
          <Card className="mb-8" data-testid="card-status-breakdown">
            <CardHeader>
              <CardTitle className="font-playfair">Patent Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {metrics.status_breakdown.map((item) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <Badge variant={item.status === 'completed' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'}>
                      {item.status}
                    </Badge>
                    <span className="font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users">
          <TabsList data-testid="tabs-admin">
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="patents" data-testid="tab-patents">Patents</TabsTrigger>
            <TabsTrigger value="promo-codes" data-testid="tab-promo-codes">Promo Codes</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-playfair">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Email</th>
                          <th className="text-left py-3 px-4">Credits</th>
                          <th className="text-left py-3 px-4">Role</th>
                          <th className="text-left py-3 px-4">Joined</th>
                          <th className="text-left py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersData?.users.map((u) => (
                          <tr key={u.id} className="border-b hover:bg-muted/50" data-testid={`row-user-${u.id}`}>
                            <td className="py-3 px-4">{u.email}</td>
                            <td className="py-3 px-4">{u.credits}</td>
                            <td className="py-3 px-4">
                              {u.is_admin ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">Admin</Badge>
                              ) : (
                                <Badge variant="secondary">User</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setSelectedUser(u)} data-testid={`button-credits-${u.id}`}>
                                      Adjust Credits
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Adjust Credits for {u.email}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div>
                                        <label className="text-sm font-medium">Current Balance: {u.credits}</label>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Amount (positive to add, negative to subtract)</label>
                                        <Input
                                          type="number"
                                          value={creditAmount}
                                          onChange={(e) => setCreditAmount(e.target.value)}
                                          placeholder="e.g., 50 or -20"
                                          data-testid="input-credit-amount"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">Description</label>
                                        <Input
                                          value={creditDescription}
                                          onChange={(e) => setCreditDescription(e.target.value)}
                                          placeholder="Reason for adjustment"
                                          data-testid="input-credit-description"
                                        />
                                      </div>
                                      <Button
                                        onClick={() => {
                                          if (creditAmount) {
                                            adjustCreditsMutation.mutate({
                                              userId: u.id,
                                              amount: parseInt(creditAmount),
                                              description: creditDescription,
                                            });
                                          }
                                        }}
                                        disabled={!creditAmount || adjustCreditsMutation.isPending}
                                        className="w-full"
                                        data-testid="button-submit-credits"
                                      >
                                        {adjustCreditsMutation.isPending ? 'Adjusting...' : 'Apply Adjustment'}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                {u.id !== user?.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAdminMutation.mutate({ userId: u.id, isAdmin: !u.is_admin })}
                                    disabled={toggleAdminMutation.isPending}
                                    data-testid={`button-toggle-admin-${u.id}`}
                                  >
                                    {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-playfair">All Patents</CardTitle>
              </CardHeader>
              <CardContent>
                {patentsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading patents...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Title</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patentsData?.patents.map((p) => (
                          <tr key={p.id} className="border-b hover:bg-muted/50" data-testid={`row-patent-${p.id}`}>
                            <td className="py-3 px-4">{p.title || 'Untitled Patent'}</td>
                            <td className="py-3 px-4">
                              <Badge variant={p.status === 'completed' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'}>
                                {p.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promo-codes" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-playfair">Promo Codes</CardTitle>
                <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-create-promo">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Promo Code</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Code</Label>
                        <Input
                          value={newPromoCode}
                          onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                          placeholder="e.g., WELCOME50"
                          data-testid="input-promo-code"
                        />
                      </div>
                      <div>
                        <Label>Credits to Award</Label>
                        <Input
                          type="number"
                          value={newPromoCredits}
                          onChange={(e) => setNewPromoCredits(e.target.value)}
                          placeholder="e.g., 50"
                          data-testid="input-promo-credits"
                        />
                      </div>
                      <div>
                        <Label>Max Redemptions (optional)</Label>
                        <Input
                          type="number"
                          value={newPromoMaxRedemptions}
                          onChange={(e) => setNewPromoMaxRedemptions(e.target.value)}
                          placeholder="Leave empty for unlimited"
                          data-testid="input-promo-max-redemptions"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          if (newPromoCode && newPromoCredits) {
                            createPromoCodeMutation.mutate({
                              code: newPromoCode,
                              creditAmount: parseInt(newPromoCredits),
                              maxRedemptions: newPromoMaxRedemptions ? parseInt(newPromoMaxRedemptions) : null,
                            });
                          }
                        }}
                        disabled={!newPromoCode || !newPromoCredits || createPromoCodeMutation.isPending}
                        className="w-full"
                        data-testid="button-submit-promo"
                      >
                        {createPromoCodeMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Promo Code'
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {promoCodesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading promo codes...</div>
                ) : !promoCodesData || promoCodesData.length === 0 ? (
                  <div className="text-center py-8">
                    <Gift className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No promo codes yet. Create your first one!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">Code</th>
                          <th className="text-left py-3 px-4">Credits</th>
                          <th className="text-left py-3 px-4">Redemptions</th>
                          <th className="text-left py-3 px-4">Status</th>
                          <th className="text-left py-3 px-4">Created</th>
                          <th className="text-left py-3 px-4">Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoCodesData.map((promo) => (
                          <tr key={promo.id} className="border-b hover:bg-muted/50" data-testid={`row-promo-${promo.id}`}>
                            <td className="py-3 px-4 font-mono font-medium">{promo.code}</td>
                            <td className="py-3 px-4">{promo.credit_amount}</td>
                            <td className="py-3 px-4">
                              {promo.current_redemptions}
                              {promo.max_redemptions && ` / ${promo.max_redemptions}`}
                            </td>
                            <td className="py-3 px-4">
                              {promo.is_active ? (
                                <Badge variant="default">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {new Date(promo.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4">
                              <Switch
                                checked={promo.is_active}
                                onCheckedChange={(checked) => 
                                  togglePromoCodeMutation.mutate({ id: promo.id, isActive: checked })
                                }
                                disabled={togglePromoCodeMutation.isPending}
                                data-testid={`switch-promo-${promo.id}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
