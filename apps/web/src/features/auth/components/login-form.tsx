import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';

import { loginSchema, authApi, type LoginData } from '../api/auth-api';

export function LoginForm() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      setError(null);
      // Login sets HTTP-only cookie automatically
      await authApi.login(data);
      // Refresh user state from server (cookie is sent automatically)
      const user = await refreshUser();
      // If user doesn't have a role, redirect to select-role
      if (!user?.role) {
        void navigate('/select-role');
      } else {
        void navigate(user.role === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to login';

      if (errorMessage?.toLowerCase().includes('blocked')) {
        void navigate('/blocked');
        return;
      }

      setError(errorMessage ?? 'Failed to login');
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="space-y-5"
    >
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="login-email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('email')}
            id="login-email"
            type="email"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
            placeholder="john@example.com"
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Link
            to="/forgot-password"
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('password')}
            id="login-password"
            type="password"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
            placeholder="••••••••"
          />
        </div>
        {errors.password && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 px-4 gradient-primary text-white rounded-xl hover:opacity-90 transition-colors font-semibold disabled:opacity-50 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        By signing in, you agree to our{' '}
        <Link
          to="/terms"
          className="text-primary hover:text-primary/80 transition-colors underline"
          target="_blank"
        >
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link
          to="/privacy"
          className="text-primary hover:text-primary/80 transition-colors underline"
          target="_blank"
        >
          Privacy Policy
        </Link>
      </p>
    </form>
  );
}
