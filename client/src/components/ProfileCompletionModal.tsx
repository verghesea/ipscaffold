import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ProfileCompletionModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ProfileCompletionModal({
  open,
  onClose,
  onComplete,
}: ProfileCompletionModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [errors, setErrors] = useState<{ displayName?: string; organization?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

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
      onComplete();
    } catch (error) {
      console.error('Failed to complete profile:', error);
      setErrors({
        displayName: error instanceof Error ? error.message : 'Failed to save profile',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await api.skipProfile();
      onComplete();
    } catch (error) {
      console.error('Failed to skip profile:', error);
    } finally {
      setIsSkipping(false);
    }
  };

  const isLoading = isSubmitting || isSkipping;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-2xl font-display">
            Your Patent Analysis is Ready!
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Help us personalize your experience by telling us a bit about yourself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Your Name</Label>
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
              disabled={isLoading}
              className={errors.displayName ? 'border-destructive' : ''}
              data-testid="input-display-name"
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization">Organization</Label>
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
              disabled={isLoading}
              className={errors.organization ? 'border-destructive' : ''}
              data-testid="input-organization"
            />
            {errors.organization && (
              <p className="text-sm text-destructive">{errors.organization}</p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
              className="flex-1"
              data-testid="button-skip-profile"
            >
              {isSkipping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Skipping...
                </>
              ) : (
                'Skip for now'
              )}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
              data-testid="button-complete-profile"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Continue to Analysis'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
