import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Verifying your login...');

  useEffect(() => {
    async function handleCallback() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        const urlParams = new URLSearchParams(window.location.search);
        const patentId = urlParams.get('patent');

        if (!accessToken) {
          const error = hashParams.get('error_description') || urlParams.get('error_description');
          if (error) {
            setStatus('error');
            setMessage(error);
            return;
          }
          
          setStatus('error');
          setMessage('No authentication token received');
          return;
        }

        const response = await fetch('/api/auth/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, patentId }),
        });

        if (!response.ok) {
          throw new Error('Failed to verify session');
        }

        setStatus('success');
        setMessage('Login successful! Redirecting...');

        setTimeout(() => {
          if (patentId) {
            setLocation(`/patent/${patentId}`);
          } else {
            setLocation('/dashboard');
          }
        }, 1000);

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
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
