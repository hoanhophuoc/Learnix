import { type ReactNode } from 'react';

import { GraduationCap, Loader2, ShieldX } from 'lucide-react';
import { Navigate, useLocation, Link, useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';
import { AuthRequiredModal } from '@/features/auth/components/auth-required-modal';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoading) {
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
            <span className="font-medium">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredModal
        isOpen={true}
        onClose={() => {
          // Navigate back when modal is closed (go to previous page or home)
          if (window.history.length > 1) {
            void navigate(-1);
          } else {
            void navigate('/');
          }
        }}
        title="Join Learnix to Continue"
        description="Create a free account to access this page, track your progress, and unlock exclusive content."
      />
    );
  }

  // Redirect to select-role if user hasn't selected a role yet
  if (user && !user?.role && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have permission to access this page. This area is
            restricted to {allowedRoles.join(' or ')} users only.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 gradient-primary text-white rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
