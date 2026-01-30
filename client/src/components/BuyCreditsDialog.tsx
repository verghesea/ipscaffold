/**
 * Buy Credits Dialog - Stripe Checkout Integration
 * Allows users to purchase additional patent credits
 */

import { useState } from 'react';
import { CreditCard, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface BuyCreditsDialogProps {
  trigger?: React.ReactNode;
}

export function BuyCreditsDialog({ trigger }: BuyCreditsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const { url } = await api.createCheckoutSession('credits_30');
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      toast({
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Buy Credits
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-600" />
            Get More Credits
          </DialogTitle>
          <DialogDescription>
            Purchase additional credits to analyze more patents.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="border-2 border-primary rounded-lg p-6 bg-card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-primary-900">
                  3 Patent Credits
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analyze 3 additional patents
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-900">$25</div>
                <div className="text-xs text-muted-foreground">one-time</div>
              </div>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground mb-6">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Full AI analysis for each patent
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                3 business artifacts per patent
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                AI-generated illustrations
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                PDF export capability
              </li>
            </ul>

            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Purchase Now
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Secure payment powered by Stripe. You will be redirected to complete your purchase.
        </p>
      </DialogContent>
    </Dialog>
  );
}
