import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const baseClasses =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-bz-primary/50 rounded-bzo-button';

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-2 gap-2',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-5 py-3 gap-3',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-bz-primary text-black shadow-md shadow-bz-primary/20 hover:brightness-105 focus:ring-offset-2 focus:ring-offset-bz-bg',
  secondary:
    'bg-bz-surfaceAlt text-bz-text border border-bz-border hover:bg-bz-surface focus:ring-offset-2 focus:ring-offset-bz-bg',
  outline:
    'bg-transparent text-bz-text border border-bz-border hover:border-bz-primary hover:text-bz-primary focus:ring-offset-2 focus:ring-offset-bz-bg',
  ghost:
    'bg-transparent text-bz-muted hover:text-bz-text hover:bg-bz-surfaceAlt/70 focus:ring-offset-2 focus:ring-offset-bz-bg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) => {
  const classes = [
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    'disabled:opacity-50 disabled:cursor-not-allowed',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
};

export default Button;
