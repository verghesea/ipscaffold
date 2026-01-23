import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Users, UserCheck, UserX, Mail, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SignupStats {
  signupCap: number;
  signupsEnabled: boolean;
  currentCount: number;
  available: boolean;
  waitlistCount: number;
}

interface WaitlistEntry {
  id: string;
  email: string;
  source: string | null;
  referrer: string | null;
  metadata: any;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export function SignupCapManager() {
  const [stats, setStats] = useState<SignupStats | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newCap, setNewCap] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, waitlistData] = await Promise.all([
        api.getSignupStats(),
        api.getWaitlist(),
      ]);
      setStats(statsData);
      setWaitlist(waitlistData);
      setNewCap(statsData.signupCap.toString());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCap = async () => {
    if (!newCap || isNaN(parseInt(newCap)) || parseInt(newCap) < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a valid number',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdating(true);
      await api.updateSignupCap(parseInt(newCap));
      toast({
        title: 'Success',
        description: `Signup cap updated to ${newCap}`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleSignups = async () => {
    if (!stats) return;

    try {
      setUpdating(true);
      await api.toggleSignupsEnabled(!stats.signupsEnabled);
      toast({
        title: 'Success',
        description: `Signups ${!stats.signupsEnabled ? 'enabled' : 'disabled'}`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async (id: string, email: string) => {
    try {
      await api.approveWaitlistEntry(id);
      toast({
        title: 'Success',
        description: `Approved ${email}`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete ${email} from waitlist?`)) return;

    try {
      await api.deleteWaitlistEntry(id);
      toast({
        title: 'Success',
        description: `Deleted ${email}`,
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Failed to load signup cap settings</AlertDescription>
      </Alert>
    );
  }

  const percentFull = (stats.currentCount / stats.signupCap) * 100;
  const pendingWaitlist = waitlist.filter(w => !w.approved);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.currentCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {percentFull.toFixed(0)}% of cap
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signup Cap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.signupCap}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.signupCap - stats.currentCount} spots left
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waitlist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingWaitlist.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.available ? (
              <Badge className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Open
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Full
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Signup Progress</span>
              <span className="text-muted-foreground">
                {stats.currentCount} / {stats.signupCap} users
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  percentFull >= 100 ? 'bg-red-500' : percentFull >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentFull, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Signup Cap Settings</CardTitle>
          <CardDescription>
            Control how many users can sign up during alpha launch
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Public Signups</Label>
              <p className="text-sm text-muted-foreground">
                {stats.signupsEnabled ? 'New users can create accounts' : 'Signups are currently disabled'}
              </p>
            </div>
            <Switch
              checked={stats.signupsEnabled}
              onCheckedChange={handleToggleSignups}
              disabled={updating}
            />
          </div>

          {/* Cap Adjustment */}
          <div className="space-y-3">
            <Label htmlFor="signup-cap">Signup Cap</Label>
            <div className="flex gap-2">
              <Input
                id="signup-cap"
                type="number"
                min="0"
                value={newCap}
                onChange={(e) => setNewCap(e.target.value)}
                disabled={updating}
                className="max-w-xs"
              />
              <Button
                onClick={handleUpdateCap}
                disabled={updating || newCap === stats.signupCap.toString()}
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Cap'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Maximum number of users who can sign up. When reached, new visitors are added to the waitlist.
            </p>
          </div>

          {/* Warning if near or at cap */}
          {percentFull >= 80 && (
            <Alert variant={percentFull >= 100 ? 'destructive' : 'default'}>
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                {percentFull >= 100
                  ? 'Signup cap reached! New users are being added to the waitlist.'
                  : `You're at ${percentFull.toFixed(0)}% of your signup cap. Consider increasing it soon.`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Waitlist */}
      {pendingWaitlist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Waitlist ({pendingWaitlist.length})</CardTitle>
            <CardDescription>
              Approve users to create their accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingWaitlist.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{entry.email}</p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(entry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(entry.id, entry.email)}
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(entry.id, entry.email)}
                    >
                      <UserX className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
