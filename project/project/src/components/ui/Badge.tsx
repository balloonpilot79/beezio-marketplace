import React from 'react';

type BadgeVariant = 'info' | 'success' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  info: 'bg-bz-primary/15 text-bz-primary border border-bz-primary/30',
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  neutral: 'bg-bz-surfaceAlt text-bz-muted border border-bz-border',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className = '', children, ...props }) => (
  <span
    className={[
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
      variantClasses[variant],
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
