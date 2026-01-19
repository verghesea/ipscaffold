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
import { Users, FileText, CreditCard, TrendingUp, Shield, ArrowLeft, Gift, Plus, Loader2, Settings, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SystemPromptManager } from '@/components/patent/SystemPromptManager';
import { MetadataCorrectionPanel } from '@/components/admin/MetadataCorrectionPanel';
import { api } from '@/lib/api';

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
  is_super_admin: boolean;
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

interface UserDetails extends User {
  patents: Patent[];
  transactions: Array<{
    id: string;
    amount: number;
    balance_after: number;
    description: string;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('');
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoCredits, setNewPromoCredits] = useState('');
  const [newPromoMaxRedemptions, setNewPromoMaxRedemptions] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCredits, setNewUserCredits] = useState('100');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);

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

  const { data: userDetails, isLoading: userDetailsLoading } = useQuery<UserDetails | null>({
    queryKey: ['admin-user-details', selectedUserId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${selectedUserId}/details`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to fetch user details');
      return res.json();
    },
    enabled: !!selectedUserId && !!profile?.is_admin,
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

  const createUserMutation = useMutation({
    mutationFn: async ({ email, credits, isAdmin }: { email: string; credits: number; isAdmin: boolean }) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, credits, isAdmin }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateUserOpen(false);
      setNewUserEmail('');
      setNewUserCredits('100');
      setNewUserIsAdmin(false);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete user');
      }
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
          <Badge variant="outline" className={profile?.is_super_admin ? "text-purple-600 border-purple-600" : "text-amber-600 border-amber-600"}>
            <Shield className="w-3 h-3 mr-1" />
            {profile?.is_super_admin ? 'Super Administrator' : 'Administrator'}
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
            <TabsTrigger value="metadata" data-testid="tab-metadata">
              <AlertCircle className="w-4 h-4 mr-2" />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="promo-codes" data-testid="tab-promo-codes">Promo Codes</TabsTrigger>
            <TabsTrigger value="system-prompts" data-testid="tab-system-prompts">System Prompts</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-playfair">User Management</CardTitle>
                {profile?.is_super_admin && (
                  <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-create-user">
                        <Plus className="w-4 h-4 mr-2" />
                        Create User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="user@example.com"
                            data-testid="input-user-email"
                          />
                        </div>
                        <div>
                          <Label>Initial Credits</Label>
                          <Input
                            type="number"
                            value={newUserCredits}
                            onChange={(e) => setNewUserCredits(e.target.value)}
                            placeholder="100"
                            data-testid="input-user-credits"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newUserIsAdmin}
                            onCheckedChange={setNewUserIsAdmin}
                            data-testid="switch-user-admin"
                          />
                          <Label>Make Admin</Label>
                        </div>
                        <Button
                          onClick={() => {
                            if (newUserEmail) {
                              createUserMutation.mutate({
                                email: newUserEmail,
                                credits: parseInt(newUserCredits) || 100,
                                isAdmin: newUserIsAdmin,
                              });
                            }
                          }}
                          disabled={!newUserEmail || createUserMutation.isPending}
                          className="w-full"
                          data-testid="button-submit-user"
                        >
                          {createUserMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create User'
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
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
                          <tr key={u.id} className="border-b hover:bg-muted/50 cursor-pointer transition" data-testid={`row-user-${u.id}`}>
                            <td className="py-3 px-4" onClick={() => setSelectedUserId(u.id)}>{u.email}</td>
                            <td className="py-3 px-4" onClick={() => setSelectedUserId(u.id)}>{u.credits}</td>
                            <td className="py-3 px-4" onClick={() => setSelectedUserId(u.id)}>
                              {u.is_super_admin ? (
                                <Badge variant="outline" className="text-purple-600 border-purple-600">Super Admin</Badge>
                              ) : u.is_admin ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">Admin</Badge>
                              ) : (
                                <Badge variant="secondary">User</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-sm" onClick={() => setSelectedUserId(u.id)}>
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
                                {profile?.is_super_admin && u.id !== user?.id && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleAdminMutation.mutate({ userId: u.id, isAdmin: !u.is_admin })}
                                      disabled={toggleAdminMutation.isPending}
                                      data-testid={`button-toggle-admin-${u.id}`}
                                    >
                                      {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete ${u.email}? This action cannot be undone.`)) {
                                          deleteUserMutation.mutate(u.id);
                                        }
                                      }}
                                      disabled={deleteUserMutation.isPending}
                                      data-testid={`button-delete-user-${u.id}`}
                                    >
                                      Delete
                                    </Button>
                                  </>
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

          <TabsContent value="metadata" className="mt-6">
            <MetadataCorrectionPanel
              patents={patentsData?.patents || []}
              onPatentUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/patents'] });
              }}
            />
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

          <TabsContent value="system-prompts" className="mt-6">
            <SystemPromptManager />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-playfair">Analytics Dashboard</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time usage statistics from Umami
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">View Full Analytics</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access detailed analytics in your Umami dashboard
                  </p>
                  <Button asChild data-testid="button-open-umami">
                    <a href="https://cloud.umami.is" target="_blank" rel="noopener noreferrer">
                      Open Umami Dashboard
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Note: Set up your Umami Cloud account and replace YOUR_WEBSITE_ID in index.html with your actual website ID.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User Profile Dialog */}
        <Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin">
            <DialogHeader>
              <DialogTitle className="font-playfair text-2xl">User Profile</DialogTitle>
            </DialogHeader>

            {userDetailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : userDetails ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{userDetails.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="font-mono text-sm truncate">{userDetails.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Credits</Label>
                    <p className="text-2xl font-bold text-primary">{userDetails.credits}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Admin Status</Label>
                    {userDetails.is_super_admin ? (
                      <Badge variant="outline" className="text-purple-600 border-purple-600">Super Admin</Badge>
                    ) : userDetails.is_admin ? (
                      <Badge variant="default">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Member Since</Label>
                    <p>{new Date(userDetails.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Patents */}
                <div>
                  <Label className="text-lg font-semibold">Patents ({userDetails.patents?.length || 0})</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {userDetails.patents?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No patents yet</p>
                    ) : (
                      userDetails.patents?.map((patent: Patent) => (
                        <div key={patent.id} className="border rounded-lg p-3 hover:bg-muted/50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{patent.title || 'Untitled Patent'}</p>
                            </div>
                            <Badge variant={
                              patent.status === 'completed' ? 'default' :
                              patent.status === 'failed' ? 'destructive' : 'secondary'
                            }>
                              {patent.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(patent.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Credit Transactions */}
                <div>
                  <Label className="text-lg font-semibold">Recent Transactions</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {!userDetails.transactions?.length ? (
                      <p className="text-sm text-muted-foreground">No transactions yet</p>
                    ) : (
                      userDetails.transactions?.slice(0, 10).map((txn) => (
                        <div key={txn.id} className="flex justify-between items-center border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">{txn.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(txn.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {txn.amount > 0 ? '+' : ''}{txn.amount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Balance: {txn.balance_after}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => {
                    const userForCredits = usersData?.users.find(u => u.id === selectedUserId);
                    if (userForCredits) {
                      setSelectedUser(userForCredits);
                      setSelectedUserId(null);
                    }
                  }} data-testid="button-profile-adjust-credits">
                    Adjust Credits
                  </Button>
                  {profile?.is_super_admin && userDetails.id !== user?.id && (
                    <>
                      <Button variant="outline" onClick={() => {
                        toggleAdminMutation.mutate({
                          userId: userDetails.id,
                          isAdmin: !userDetails.is_admin
                        });
                        queryClient.invalidateQueries({ queryKey: ['admin-user-details', selectedUserId] });
                      }} data-testid="button-profile-toggle-admin">
                        {userDetails.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </Button>
                      <Button variant="destructive" onClick={() => {
                        if (confirm(`Are you sure you want to delete ${userDetails.email}? This action cannot be undone.`)) {
                          deleteUserMutation.mutate(userDetails.id);
                          setSelectedUserId(null);
                        }
                      }} disabled={deleteUserMutation.isPending} data-testid="button-profile-delete-user">
                        Delete User
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
