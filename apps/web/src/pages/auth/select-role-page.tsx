import { useState } from 'react';

import {
  GraduationCap,
  BookOpen,
  Loader2,
  AlertCircle,
  Sparkles,
  Users,
  Trophy,
  Lightbulb,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '@/contexts/use-auth';
import { authApi } from '@/features/auth/api/auth-api';
import { cn } from '@/lib/utils';

type Role = 'student' | 'instructor';

function getRoleDisplayText(role: Role | null): string {
  if (role === 'instructor') {
    return 'Instructor';
  }
  if (role === 'student') {
    return 'Student';
  }
  return '...';
}

const roleOptions = [
  {
    role: 'student' as Role,
    title: 'Learn',
    subtitle: 'As a Student',
    description:
      'Access courses, take quizzes, and track your learning progress',
    icon: GraduationCap,
    gradient: 'from-blue-500 via-blue-600 to-indigo-600',
    bgGradient: 'from-blue-500/10 via-blue-600/10 to-indigo-600/10',
    hoverGlow: 'group-hover:shadow-blue-500/20',
    features: [
      { icon: BookOpen, text: 'Access unlimited courses' },
      { icon: Trophy, text: 'Earn achievements & badges' },
      { icon: BarChart3, text: 'Track detailed progress' },
    ],
  },
  {
    role: 'instructor' as Role,
    title: 'Teach',
    subtitle: 'As an Instructor',
    description: 'Create courses, design quizzes with AI, and inspire learners',
    icon: BookOpen,
    gradient: 'from-purple-500 via-purple-600 to-pink-600',
    bgGradient: 'from-purple-500/10 via-purple-600/10 to-pink-600/10',
    hoverGlow: 'group-hover:shadow-purple-500/20',
    features: [
      { icon: Lightbulb, text: 'Create engaging courses' },
      { icon: Sparkles, text: 'AI-powered quiz generator' },
      { icon: Users, text: 'Build learning communities' },
    ],
  },
];

export function SelectRolePage() {
  const { refreshUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRole = async () => {
    if (!selectedRole) {
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      await authApi.selectRole({ role: selectedRole });
      const updatedUser = await refreshUser();

      // Verify role was updated successfully
      if (updatedUser?.role) {
        // Use window.location to ensure proper redirect after role update
        window.location.href =
          updatedUser.role === 'admin' ? '/admin' : '/dashboard';
      } else {
        setError('Role update failed');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : 'Failed to select role';
      setError(errorMessage ?? 'Failed to select role');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gradient-hero">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-4xl animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 gradient-primary rounded-xl shadow-lg shadow-primary/25">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <span className="text-3xl font-bold text-foreground">Learnix</span>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              Welcome aboard!
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            How do you want to use Learnix?
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Choose your path. You can always change this later in settings.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-center gap-2 p-4 mb-6 text-destructive bg-destructive/10 rounded-xl border border-destructive/20 max-w-md mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {roleOptions.map((option, index) => {
            const Icon = option.icon;
            const isSelected = selectedRole === option.role;

            return (
              <button
                key={option.role}
                onClick={() => setSelectedRole(option.role)}
                disabled={isSubmitting}
                style={{ animationDelay: `${index * 150}ms` }}
                className={cn(
                  'relative group premium-card text-left p-6 rounded-2xl border-2 transition-all duration-300 overflow-hidden animate-fade-in',
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/20 scale-[1.03] ring-2 ring-primary/30 glow-primary'
                    : 'border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:bg-card hover:shadow-xl',
                  option.hoverGlow,
                )}
              >
                {/* Selection indicator with animation */}
                {isSelected && (
                  <div className="absolute top-4 right-4 animate-fade-in">
                    <div className="p-1.5 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50 animate-pulse">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                )}

                {/* Gradient background on hover/select with smoother transition */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 transition-opacity duration-500 bg-linear-to-br',
                    option.bgGradient,
                    isSelected ? 'opacity-100' : 'group-hover:opacity-70',
                  )}
                />

                {/* Animated border glow effect */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-transparent via-primary/20 to-transparent animate-pulse" />
                )}

                <div className="relative z-10">
                  {/* Icon with enhanced animation */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 bg-linear-to-br shadow-md',
                      option.gradient,
                      isSelected
                        ? 'shadow-2xl shadow-primary/40 scale-110 animate-bounce'
                        : 'group-hover:shadow-xl group-hover:shadow-primary/30 group-hover:scale-105',
                    )}
                  >
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-bold mb-1 transition-colors">
                    {option.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-3 font-medium">
                    {option.subtitle}
                  </p>
                  <p className="text-foreground/80 mb-5 leading-relaxed">
                    {option.description}
                  </p>

                  {/* Features with stagger animation */}
                  <div className="space-y-2.5">
                    {option.features.map((feature, featureIndex) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div
                          key={feature.text}
                          className="flex items-center gap-3 animate-fade-in"
                          style={{
                            animationDelay: `${index * 150 + featureIndex * 100}ms`,
                          }}
                        >
                          <div
                            className={cn(
                              'p-1.5 rounded-lg transition-all duration-300',
                              isSelected
                                ? 'bg-primary/20 text-primary shadow-md shadow-primary/20'
                                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                            )}
                          >
                            <FeatureIcon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-foreground/80">
                            {feature.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => void handleSelectRole()}
            disabled={!selectedRole || isSubmitting}
            className={cn(
              'relative px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 overflow-hidden group/btn',
              selectedRole
                ? 'gradient-primary text-white shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.05] active:scale-[0.98] glow-primary'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50',
            )}
          >
            {/* Animated shine effect */}
            {selectedRole && !isSubmitting && (
              <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-linear-to-r from-transparent via-white/20 to-transparent" />
            )}

            <span className="relative z-10 flex items-center gap-3">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                <>
                  Continue as {getRoleDisplayText(selectedRole)}
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </>
              )}
            </span>
          </button>

          {/* Footer note with better styling */}
          <p className="text-center text-sm text-muted-foreground max-w-md">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
              Don&apos;t worry, you can switch between roles anytime from your
              settings.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SelectRolePage;
