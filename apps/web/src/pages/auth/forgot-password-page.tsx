import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  GraduationCap,
  Mail,
  AlertCircle,
  Loader2,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  authApi,
  forgotPasswordSchema,
  type ForgotPasswordData,
} from '@/features/auth/api/auth-api';

export function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      setIsSubmitting(true);
      await authApi.forgotPassword(data);
      setIsSuccess(true);
      setIsSubmitting(false);
    } catch {
      // Always show success for security (don't reveal if email exists)
      setIsSuccess(true);
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
          {isSuccess ? (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-green-500/10 rounded-full">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Check Your Email
              </h1>
              <p className="text-muted-foreground mb-6">
                If an account exists with that email address, we&apos;ve sent
                you a link to reset your password. The link will expire in 1
                hour.
              </p>
              <div className="space-y-3">
                <Link to="/login">
                  <Button className="w-full gradient-primary text-white">
                    Back to Login
                  </Button>
                </Link>
                <button
                  onClick={() => setIsSuccess(false)}
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Didn&apos;t receive an email? Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Forgot Password?
                </h1>
                <p className="text-muted-foreground">
                  No worries! Enter your email and we&apos;ll send you a reset
                  link.
                </p>
              </div>

              <form
                onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      {...register('email')}
                      id="email"
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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gradient-primary text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
