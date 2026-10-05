import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  GraduationCap,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  authApi,
  resetPasswordSchema,
  type ResetPasswordData,
} from '@/features/auth/api/auth-api';

type ResetStatus = 'loading' | 'ready' | 'success' | 'error';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<ResetStatus>(token ? 'ready' : 'error');
  const [errorMessage, setErrorMessage] = useState(
    token ? '' : 'Invalid reset link. No token provided.',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordData) => {
    if (!token) {
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.resetPassword(token, data.newPassword);
      setStatus('success');
      setIsSubmitting(false);
    } catch (error: unknown) {
      setStatus('error');
      const errorMsg =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to reset password';
      setErrorMessage(errorMsg ?? 'Failed to reset password');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background gradient-hero">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 gradient-primary rounded-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-foreground">Learnix</span>
        </div>

        <div className="glass rounded-2xl p-8 shadow-xl">
          {status === 'loading' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Verifying Reset Link
              </h1>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Reset Your Password
                </h1>
                <p className="text-muted-foreground">
                  Enter your new password below.
                </p>
              </div>

              <form
                onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                className="space-y-5"
              >
                {/* New Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="newPassword"
                    className="text-sm font-medium text-foreground"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      {...register('newPassword')}
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium text-foreground"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      {...register('confirmPassword')}
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gradient-primary text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </form>
            </>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-green-500/10 rounded-full">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Password Reset Successfully
              </h1>
              <p className="text-muted-foreground mb-6">
                Your password has been updated. You can now log in with your new
                password.
              </p>
              <Link to="/login">
                <Button className="w-full gradient-primary text-white">
                  Go to Login
                </Button>
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-destructive/10 rounded-full">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Reset Failed
              </h1>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <div className="space-y-3">
                <Link to="/forgot-password">
                  <Button className="w-full gradient-primary text-white">
                    Request New Link
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
