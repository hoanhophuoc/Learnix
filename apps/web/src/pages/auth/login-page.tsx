import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { LoginForm } from '@/features/auth/components/login-form';
import { oauthUrls } from '@/lib/config';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const registered = searchParams.get('registered') === 'true';

  const handleGoogleLogin = () => {
    window.location.href = oauthUrls.google;
  };

  const handleGithubLogin = () => {
    window.location.href = oauthUrls.github;
  };

  return (
    <div className="min-h-screen flex relative">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 animate-in fade-in slide-in-from-left-4 duration-500">
        <Link to="/">
          <Button
            variant="ghost"
            className="w-12 h-12 rounded-full bg-background/30 dark:bg-black/30 backdrop-blur-md border border-foreground/10 hover:bg-background/50 dark:hover:bg-white/10 hover:scale-110 transition-colors duration-300 shadow-lg group p-0 flex items-center justify-center"
          >
            <ChevronLeft
              className="w-6 h-6 text-foreground dark:text-white group-hover:-translate-x-1 transition-transform duration-300"
              strokeWidth={2.5}
            />
            <span className="sr-only">Back to Home</span>
          </Button>
        </Link>
      </div>

      {/* Left Panel - Branding (No changes below) */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        {/* ... existing left panel content ... */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <GraduationCap className="w-10 h-10" />
            </div>
            <span className="text-4xl font-bold tracking-tight">Learnix</span>
          </div>

          <h2 className="text-3xl font-semibold text-center mb-4">
            Learn Smarter, Not Harder
          </h2>
          <p className="text-lg text-white/80 text-center max-w-md leading-relaxed">
            Join thousands of learners mastering new skills with AI-powered
            quizzes and personalized learning paths.
          </p>

          <div className="mt-12 flex items-center gap-2 text-white/70">
            <Sparkles className="w-5 h-5" />
            <span>Powered by AI</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form (No changes) */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background gradient-hero">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8 mt-8">
            {/* Added mt-8 to give space from the back button on mobile */}
            <div className="p-2 gradient-primary rounded-lg">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">Learnix</span>
          </div>

          {/* ... existing form content ... */}
          <div className="glass rounded-2xl p-8 shadow-xl">
            {/* ... rest of the component ... */}
            {registered && (
              <div className="flex items-center justify-center gap-2 p-4 mb-6 text-green-600 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">
                  Account created! Please login to continue.
                </span>
              </div>
            )}

            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Welcome Back
              </h1>
              <p className="text-muted-foreground">
                Enter your credentials to continue learning
              </p>
            </div>

            <LoginForm />

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground rounded-full">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGoogleLogin}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-card border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-colors duration-200 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="font-medium text-sm group-hover:text-primary transition-colors">
                  Google
                </span>
              </button>

              <button
                onClick={handleGithubLogin}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-card border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-colors duration-200 group"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="font-medium text-sm group-hover:text-primary transition-colors">
                  GitHub
                </span>
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
