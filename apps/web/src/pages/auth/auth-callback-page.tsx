import { useEffect, useState } from 'react';

import { GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';

/**
 * OAuth Callback Handler
 * Token is now stored in encrypted HTTP-only cookie by backend.
 * This page handles the post-OAuth redirect and refreshes user state.
 */

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cookieTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Token is now stored in encrypted HTTP-only cookie by backend
        // No need to extract from URL - just refresh user state
        // The encrypted cookie will be sent automatically with the API request

        // Small delay to ensure cookie is set before making API call
        await new Promise((resolve) => {
          cookieTimeoutId = setTimeout(resolve, 100);
        });
        if (cancelled) return;

        // Refresh user state from server (encrypted cookie is sent automatically)
        const user = await refreshUser();
        if (cancelled) return;

        // Redirect based on user role status
        if (!user?.role) {
          window.location.href = '/select-role';
        } else {
          window.location.href =
            user.role === 'admin' ? '/admin' : '/dashboard';
        }
      } catch {
        if (cancelled) return;
        setError('Authentication failed. Please try again.');
        timeoutId = setTimeout(() => {
          void navigate('/login');
        }, 2000);
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (cookieTimeoutId) clearTimeout(cookieTimeoutId);
    };
  }, [refreshUser, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <div className="text-center animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-destructive/10 rounded-xl">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero">
      <div className="text-center animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 gradient-primary rounded-xl">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <span className="text-3xl font-bold text-foreground">Learnix</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="font-medium">Signing you in...</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Please wait while we complete authentication
        </p>
      </div>
    </div>
  );
}

export default AuthCallbackPage;
