import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantStyles = new Map<BadgeVariant, string>([
  ['default', 'bg-primary text-primary-foreground'],
  ['secondary', 'bg-secondary text-secondary-foreground'],
  [
    'success',
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ],
  [
    'warning',
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ],
  ['danger', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'],
]);

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantStyles.get(variant),
        props.onClick && 'cursor-pointer hover:opacity-80',
        className,
      )}
      {...props}
    />
  );
}
