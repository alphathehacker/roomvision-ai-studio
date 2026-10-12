import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-moss text-white hover:bg-moss-deep shadow-sm',
  secondary: 'bg-sand text-charcoal hover:bg-sand-deep border border-line',
  ghost: 'text-charcoal-soft hover:bg-sand hover:text-charcoal',
  danger: 'bg-red-700/90 text-white hover:bg-red-800 shadow-sm',
  outline: 'border border-moss text-moss-deep hover:bg-moss/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-9 w-9 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <span className="rv-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});
