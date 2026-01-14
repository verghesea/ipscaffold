import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, type OrganizationMember, type Organization } from '@/lib/api';
import { Layout } from '@/components/layout/Layout';
import { Building2, Users, Mail, Trash2, Shield, Eye, UserCog, Edit2, X, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocation } from 'wouter';

export function OrganizationSettingsPage() {
  const { currentOrganization, user, refetch } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!currentOrganization) {
      toast({
        title: 'No organization selected',
        description: 'Please select an organization first',
        variant: 'destructive',
      });
      setLocation('/dashboard');
      return;
    }

    setNewOrgName(currentOrganization.name);
    loadMembers();
  }, [currentOrganization]);

  const loadMembers = async () => {
    if (!currentOrganization) return;

    try {
      const data = await api.getOrganizationMembers(currentOrganization.id);
      setMembers(data.members);
    } catch (error: any) {
      toast({
        title: 'Failed to load members',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!currentOrganization || !inviteEmail) return;

    setIsInviting(true);
    try {
      await api.inviteOrganizationMember(currentOrganization.id, inviteEmail, inviteRole);
      toast({
        title: 'Member invited',
        description: `${inviteEmail} has been added to the organization`,
      });
      setInviteEmail('');
      setInviteRole('member');
      setInviteDialogOpen(false);
      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Failed to invite member',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!currentOrganization) return;

    try {
      await api.removeOrganizationMember(currentOrganization.id, memberId);
      toast({
        title: 'Member removed',
        description: `${email} has been removed from the organization`,
      });
      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    if (!currentOrganization) return;

    try {
      await api.updateOrganizationMemberRole(currentOrganization.id, memberId, newRole);
      toast({
        title: 'Role updated',
        description: 'Member role has been updated successfully',
      });
      loadMembers();
    } catch (error: any) {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateOrgName = async () => {
    if (!currentOrganization || !newOrgName.trim()) return;

    try {
      await api.updateOrganization(currentOrganization.id, newOrgName.trim());
      toast({
        title: 'Organization updated',
        description: 'Organization name has been updated successfully',
      });
      await refetch();
      setEditingName(false);
    } catch (error: any) {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'member':
        return 'secondary';
      case 'viewer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'member':
        return <UserCog className="w-4 h-4" />;
      case 'viewer':
        return <Eye className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const isAdmin = currentOrganization?.role === 'admin';

  if (!currentOrganization) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-6 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-primary-900 mb-2">
            Organization Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your organization's settings and members
          </p>
        </div>

        <div className="grid gap-6">
          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Organization Details
              </CardTitle>
              <CardDescription>
                View and manage your organization's information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization Name</Label>
                {editingName ? (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Enter organization name"
                      maxLength={100}
                    />
                    <Button onClick={handleUpdateOrgName} size="icon">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingName(false);
                        setNewOrgName(currentOrganization.name);
                      }}
                      size="icon"
                      variant="outline"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-lg font-medium">{currentOrganization.name}</div>
                    {isAdmin && (
                      <Button
                        onClick={() => setEditingName(true)}
                        size="icon"
                        variant="ghost"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label>Credit Balance</Label>
                <div className="text-2xl font-bold text-primary-900 mt-1">
                  {currentOrganization.credits} Credits
                </div>
              </div>

              <div>
                <Label>Your Role</Label>
                <div className="mt-2">
                  <Badge variant={getRoleBadgeVariant(currentOrganization.role || 'member')}>
                    <span className="flex items-center gap-1">
                      {getRoleIcon(currentOrganization.role || 'member')}
                      {currentOrganization.role || 'member'}
                    </span>
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Members Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Members ({members.length})
                  </CardTitle>
                  <CardDescription>
                    Manage who has access to this organization
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Mail className="w-4 h-4 mr-2" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Invite someone to join your organization by email. They must already have an account.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="member@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="role">Role</Label>
                          <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                              <SelectItem value="member">Member - Can upload and view patents</SelectItem>
                              <SelectItem value="admin">Admin - Full access</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
                          {isInviting ? 'Inviting...' : 'Send Invite'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members yet. Invite someone to get started!
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const isCurrentUser = member.userId === user?.id;
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.email}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2">You</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isAdmin && !isCurrentUser ? (
                                <Select
                                  value={member.role}
                                  onValueChange={(value: any) =>
                                    handleUpdateRole(member.userId, value)
                                  }
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  <span className="flex items-center gap-1">
                                    {getRoleIcon(member.role)}
                                    {member.role}
                                  </span>
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(member.joinedAt).toLocaleDateString()}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                {!isCurrentUser && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove {member.email} from this
                                          organization? They will lose access to all patents and data.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() =>
                                            handleRemoveMember(member.userId, member.email)
                                          }
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
