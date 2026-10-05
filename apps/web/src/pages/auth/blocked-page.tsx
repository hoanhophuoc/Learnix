import { ShieldAlert, BookX, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export default function BlockedPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-destructive/5 rounded-full blur-[120px] animate-pulse" />

      <div className="max-w-md w-full relative z-10 text-center space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="relative inline-block group">
          <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl group-hover:bg-destructive/30 transition-colors duration-500" />
          <div className="relative w-32 h-32 rounded-full bg-card border-4 border-destructive/10 flex items-center justify-center shadow-2xl">
            <ShieldAlert
              className="w-16 h-16 text-destructive animate-in zoom-in duration-500"
              strokeWidth={1.5}
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-destructive text-white p-2 rounded-full shadow-lg">
            <BookX className="w-5 h-5" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-destructive to-destructive/70">
            Account Suspended
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            We noticed some unusual activity on your account. Access has been
            temporarily restricted to ensure platform safety.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-4 text-left">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Need help?</p>
              <p className="text-xs text-muted-foreground">
                Contact our support team to resolve this issue.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-1/2 rounded-xl gradient-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-colors hover:-translate-y-0.5"
          >
            <a href="mailto:support@learnix.com">Contact Support</a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-1/2 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
