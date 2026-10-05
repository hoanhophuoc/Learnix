import { X, GraduationCap, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function AuthRequiredModal({
  isOpen,
  onClose,
  title = 'Join Learnix to Continue',
  description = 'Create a free account to enroll in courses, track your progress, and access exclusive content.',
}: AuthRequiredModalProps) {
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  // Render modal at document body level using portal to ensure full viewport coverage
  return createPortal(
    <>
      {/* Backdrop - fixed to cover entire viewport */}
      <div
        className="fixed inset-0 z-100 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
        // onClick={onClose} // Disabled to enforce explicit close action
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClose();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal Content - centered with padding */}
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4 pointer-events-none animate-fade-in">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="relative bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden transform transition-colors scale-100 pointer-events-auto"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center p-8 pb-6">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 mb-6">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>

            <h3
              id="auth-modal-title"
              className="text-2xl font-bold text-foreground mb-2"
            >
              {title}
            </h3>

            <p className="text-muted-foreground leading-relaxed mb-8">
              {description}
            </p>

            <div className="w-full space-y-3">
              <Button
                size="lg"
                className="w-full group"
                onClick={() => void navigate('/register')}
              >
                Get Started for Free
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => void navigate('/login')}
              >
                Sign In
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 p-4 text-center text-xs text-muted-foreground border-t border-border">
            No credit card required • Free access to preview lessons
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
