import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserX, Mail, CheckCircle, ArrowLeft, Info } from 'lucide-react';

export function AlphaFullPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [alreadyOnWaitlist, setAlreadyOnWaitlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get email from URL params (passed from login/signup)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'alpha_full_page',
          referrer: document.referrer,
          metadata: {
            useCase: useCase || null,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Check if already on waitlist
        if (data.error?.includes('already on waitlist') || data.error?.includes('duplicate')) {
          setAlreadyOnWaitlist(true);
          setSubmitted(true);
          return;
        }

        throw new Error(data.error || 'Failed to join waitlist');
      }

      setAlreadyOnWaitlist(false);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              alreadyOnWaitlist ? 'bg-blue-500/10' : 'bg-green-500/10'
            }`}>
              {alreadyOnWaitlist ? (
                <Info className="w-6 h-6 text-blue-500" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
            </div>
            <CardTitle className="font-playfair text-2xl">
              {alreadyOnWaitlist ? "You're Already on the Waitlist!" : "You're on the List!"}
            </CardTitle>
            <CardDescription>
              {alreadyOnWaitlist
                ? "We've got you - you'll be notified when spots open up"
                : "We'll notify you as soon as a spot opens up"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {alreadyOnWaitlist
                ? "Good news! We checked and you're already on our waitlist. No need to sign up again."
                : "Thank you for your interest in IP Scaffold. We're limiting our alpha to ensure the best experience for early users."
              }
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {alreadyOnWaitlist
                ? "We'll release new batches regularly, and you'll receive an email at "
                : "You'll receive an email at "
              }
              <strong>{email}</strong> when you can create your account.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
            <UserX className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle className="font-playfair text-2xl">Alpha is Currently Full</CardTitle>
          <CardDescription>
            Join the waitlist to be notified when we have capacity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We're limiting our alpha launch to ensure we can provide the best experience and support for early users.
            </p>
            <p className="text-sm text-muted-foreground">
              Join our waitlist and you'll be notified as soon as a spot opens up.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="useCase" className="text-sm">
                Tell us how you'll use IP Scaffold <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="useCase"
                placeholder="We're always looking for interesting use cases. Share yours and we might bump you up the line!"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                disabled={loading}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Examples: patent analysis for portfolio management, prior art searches, competitive intelligence, etc.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? (
                <>
                  <Mail className="w-4 h-4 mr-2 animate-pulse" />
                  Joining Waitlist...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Join Waitlist
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
