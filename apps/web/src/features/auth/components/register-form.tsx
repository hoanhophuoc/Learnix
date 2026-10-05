import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Mail,
  Lock,
  User,
  AlertCircle,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { registerSchema, authApi, type RegisterData } from '../api/auth-api';

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      setError(null);
      setSuccess(null);
      // Send only the fields the backend expects (exclude confirmPassword and termsAccepted)
      const { confirmPassword: _, termsAccepted: __, ...registerData } = data;
      const response = await authApi.register(registerData);
      // Store email for resend functionality
      setRegisteredEmail(data.email);
      // Show success message - user needs to verify email
      setSuccess(
        response.message ||
          'Registration successful! Please check your email to activate your account.',
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to register';
      setError(errorMessage ?? 'Failed to register');
    }
  };

  const handleResendActivation = async () => {
    if (!registeredEmail) {
      return;
    }

    try {
      setIsResending(true);
      setError(null);
      await authApi.resendActivation(registeredEmail);
      setSuccess(
        'A new activation email has been sent. Please check your inbox.',
      );
      setIsResending(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to resend activation email';
      setError(errorMessage ?? 'Failed to resend activation email');
      setIsResending(false);
    }
  };

  // Show success message after registration
  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-green-500/10 rounded-full">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground">
          Check Your Email
        </h3>
        <p className="text-muted-foreground">{success}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or{' '}
          <button
            onClick={() => void handleResendActivation()}
            disabled={isResending}
            className="text-primary hover:underline disabled:opacity-50"
          >
            {isResending ? 'Sending...' : 'resend activation email'}
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          The activation link expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      className="space-y-4"
    >
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="register-fullName"
          className="text-sm font-medium text-foreground"
        >
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('fullName')}
            id="register-fullName"
            type="text"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
            placeholder="John Doe"
          />
        </div>
        {errors.fullName && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.fullName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('email')}
            id="register-email"
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
        <label
          htmlFor="register-password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('password')}
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.password.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Must be at least 6 characters
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="register-confirmPassword"
          className="text-sm font-medium text-foreground"
        >
          Confirm Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            {...register('confirmPassword')}
            id="register-confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary focus:bg-background transition-colors"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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

      <div className="space-y-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            {...register('termsAccepted')}
            type="checkbox"
            className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
          />
          <span className="text-sm text-muted-foreground">
            I agree to the{' '}
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
          </span>
        </label>
        {errors.termsAccepted && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.termsAccepted.message}
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
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
