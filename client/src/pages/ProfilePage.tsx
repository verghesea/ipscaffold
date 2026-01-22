import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ProfilePage() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [errors, setErrors] = useState<{ displayName?: string; organization?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with current values
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setOrganization(user.organization || '');
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: { displayName?: string; organization?: string } = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    }

    if (!organization.trim()) {
      newErrors.organization = 'Organization is required';
    } else if (organization.trim().length < 2) {
      newErrors.organization = 'Organization must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.completeProfile(displayName.trim(), organization.trim());
      await refetch();
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-12">
          <p className="text-center text-muted-foreground">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-display">Edit Profile</CardTitle>
            <CardDescription>
              Update your personal information and organization details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your email cannot be changed.
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  <User className="w-4 h-4 inline mr-1" />
                  Your Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="John Smith"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (errors.displayName) {
                      setErrors((prev) => ({ ...prev, displayName: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={errors.displayName ? 'border-destructive' : ''}
                  data-testid="input-display-name"
                />
                {errors.displayName && (
                  <p className="text-sm text-destructive">{errors.displayName}</p>
                )}
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <Label htmlFor="organization">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Organization
                </Label>
                <Input
                  id="organization"
                  type="text"
                  placeholder="Acme Corp"
                  value={organization}
                  onChange={(e) => {
                    setOrganization(e.target.value);
                    if (errors.organization) {
                      setErrors((prev) => ({ ...prev, organization: undefined }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={errors.organization ? 'border-destructive' : ''}
                  data-testid="input-organization"
                />
                {errors.organization && (
                  <p className="text-sm text-destructive">{errors.organization}</p>
                )}
              </div>

              {/* Credits Display */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Account Credits</Label>
                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 bg-secondary rounded-lg">
                    <span className="text-lg font-semibold text-primary-900">
                      {user.credits} Credits
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ({Math.floor(user.credits / 10)} uploads remaining)
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                  data-testid="button-save-profile"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
