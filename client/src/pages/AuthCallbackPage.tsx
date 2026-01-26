import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { setStoredTokens } from '@/lib/api';
import { analytics } from '@/lib/analytics';

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Verifying your login...');

  useEffect(() => {
    async function handleCallback() {
      try {
        const configResponse = await fetch('/api/supabase-config');
        const config = await configResponse.json();
        
        const supabase = createClient(config.url, config.anonKey);
        
        const urlParams = new URLSearchParams(window.location.search);
        const patentId = urlParams.get('patent');
        const tokenHash = urlParams.get('token_hash');
        const type = urlParams.get('type');
        
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        console.log('Auth callback params:', { patentId, tokenHash: !!tokenHash, type, accessToken: !!accessToken });
        
        if (tokenHash && type) {
          console.log('Verifying token hash client-side...');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          
          if (error) {
            console.error('Token verification error:', error);
            throw error;
          }
          
          if (!data.session) {
            throw new Error('No session returned from token verification');
          }
          
          // Store tokens in localStorage for API calls
          setStoredTokens(data.session.access_token, data.session.refresh_token);
          
          // Verify with backend and handle patent claiming
          const response = await fetch('/api/auth/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              accessToken: data.session.access_token, 
              refreshToken: data.session.refresh_token,
              patentId 
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();

            // Handle signup cap reached for OAuth
            if (errorData.code === 'SIGNUP_CAP_REACHED') {
              setStatus('error');
              setMessage('Alpha is full. Redirecting to waitlist...');
              setTimeout(() => {
                const email = errorData.email || '';
                setLocation(`/alpha-full?email=${encodeURIComponent(email)}&source=google`);
              }, 2000);
              return;
            }

            throw new Error(errorData.details || 'Failed to set up session');
          }

          setStatus('success');
          setMessage('Login successful! Redirecting...');
          analytics.trackLogin();

          setTimeout(() => {
            if (patentId) {
              setLocation(`/patent/${patentId}`);
            } else {
              setLocation('/dashboard');
            }
          }, 1000);
          return;
        }
        
        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error) throw error;
          
          if (data.session) {
            setStoredTokens(data.session.access_token, data.session.refresh_token);
          }
          
          const response = await fetch('/api/auth/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: data.session?.access_token,
              refreshToken: data.session?.refresh_token,
              patentId
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();

            // Handle signup cap reached for OAuth
            if (errorData.code === 'SIGNUP_CAP_REACHED') {
              setStatus('error');
              setMessage('Alpha is full. Redirecting to waitlist...');
              setTimeout(() => {
                const email = errorData.email || '';
                setLocation(`/alpha-full?email=${encodeURIComponent(email)}&source=google`);
              }, 2000);
              return;
            }

            throw new Error(errorData.error || 'Failed to verify session');
          }

          setStatus('success');
          setMessage('Login successful! Redirecting...');
          analytics.trackLogin();

          setTimeout(() => {
            if (patentId) {
              setLocation(`/patent/${patentId}`);
            } else {
              setLocation('/dashboard');
            }
          }, 1000);
          return;
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          const errorDesc = hashParams.get('error_description') || urlParams.get('error_description');
          if (errorDesc) {
            setStatus('error');
            setMessage(decodeURIComponent(errorDesc));
            return;
          }
          
          setStatus('error');
          setMessage('No authentication token received. The link may have expired.');
          return;
        }
        
        setStoredTokens(session.access_token, session.refresh_token);
        
        const response = await fetch('/api/auth/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            patentId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();

          // Handle signup cap reached for OAuth
          if (errorData.code === 'SIGNUP_CAP_REACHED') {
            setStatus('error');
            setMessage('Alpha is full. Redirecting to waitlist...');
            setTimeout(() => {
              const email = errorData.email || '';
              setLocation(`/alpha-full?email=${encodeURIComponent(email)}&source=google`);
            }, 2000);
            return;
          }

          throw new Error(errorData.error || 'Failed to verify session');
        }

        setStatus('success');
        setMessage('Login successful! Redirecting...');
        analytics.trackLogin();

        setTimeout(() => {
          if (patentId) {
            setLocation(`/patent/${patentId}`);
          } else {
            setLocation('/dashboard');
          }
        }, 1000);

      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(error?.message || 'Authentication failed. Please try again.');
      }
    }

    handleCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        {status === 'processing' && (
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        )}
        {status === 'success' && (
          <div className="text-green-600 text-4xl mb-4">✓</div>
        )}
        {status === 'error' && (
          <div className="text-red-600 text-4xl mb-4">✗</div>
        )}
        <p className="text-lg text-muted-foreground">{message}</p>
        {status === 'error' && (
          <button 
            onClick={() => setLocation('/')}
            className="mt-4 text-primary hover:underline"
          >
            Return to home
          </button>
        )}
      </div>
    </div>
  );
}
