import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  asChild?: boolean;
}

const variantStyles = new Map<ButtonVariant, string>([
  [
    'primary',
    'gradient-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:opacity-90 glow-primary',
  ],
  ['secondary', 'bg-secondary text-secondary-foreground hover:bg-secondary/80'],
  [
    'outline',
    'border border-border bg-transparent hover:bg-muted hover:border-primary/50',
  ],
  ['ghost', 'bg-transparent hover:bg-muted'],
  [
    'destructive',
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/25',
  ],
]);

const sizeStyles = new Map<ButtonSize, string>([
  ['sm', 'h-8 px-3 text-xs rounded-lg gap-1.5'],
  ['md', 'h-10 px-4 text-sm rounded-xl gap-2'],
  ['lg', 'h-12 px-6 text-base rounded-xl gap-2'],
]);

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  asChild = false,
  ...props
}: ButtonProps) {
  const buttonStyles = cn(
    'inline-flex items-center justify-center font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]',
    variantStyles.get(variant),
    sizeStyles.get(size),
    className,
  );

  // When asChild is true, Slot expects exactly one child element
  // We pass through children directly and let the child handle its own content
  if (asChild) {
    return (
      <Slot className={buttonStyles} {...props}>
        {children}
      </Slot>
    );
  }

  // Determine the left icon to show
  const leftContent = isLoading ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    (leftIcon ?? null)
  );

  return (
    <button
      className={buttonStyles}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {leftContent}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}
