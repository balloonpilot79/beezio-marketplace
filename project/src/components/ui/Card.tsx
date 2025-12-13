import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ className = '', padded = true, children, ...props }) => (
  <div
    className={[
      'bg-bz-surface border border-bz-border text-bz-text rounded-bzo-card shadow-sm',
      padded ? 'p-4 md:p-6' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={['flex items-start justify-between gap-3', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', children, ...props }) => (
  <h3 className={['text-lg font-semibold text-bz-text', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </h3>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={['mt-4 space-y-4', className].filter(Boolean).join(' ')} {...props}>
    {children}
  </div>
);

export default Card;
