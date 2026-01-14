import { useState } from 'react';
import { api } from '@/lib/api';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface FirstTimeOrgSetupProps {
  open: boolean;
  onComplete: () => void;
  userEmail: string;
}

export function FirstTimeOrgSetup({ open, onComplete, userEmail }: FirstTimeOrgSetupProps) {
  const [orgName, setOrgName] = useState(`${userEmail.split('@')[0]}'s Organization`);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!orgName.trim()) {
      toast({
        title: 'Organization name required',
        description: 'Please enter a name for your organization',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await api.createOrganization(orgName.trim());
      toast({
        title: 'Organization created',
        description: 'Your organization has been created successfully',
      });
      onComplete();
    } catch (error: any) {
      toast({
        title: 'Failed to create organization',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to IP Scaffold!</DialogTitle>
          <DialogDescription className="text-center">
            Let's set up your organization to get started. You can invite team members later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter organization name"
              maxLength={100}
              className="mt-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
            />
            <p className="text-sm text-muted-foreground mt-2">
              This can be your company name, team name, or just your personal workspace.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={isCreating || !orgName.trim()} className="w-full">
            {isCreating ? 'Creating...' : 'Create Organization'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
