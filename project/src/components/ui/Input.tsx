import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, className = '', ...props }, ref) => {
    return (
      <label className="block space-y-1.5 text-sm text-bz-muted">
        {label && <span className="font-medium text-bz-text/90">{label}</span>}
        <input
          ref={ref}
          className={[
            'w-full bg-bz-surfaceAlt text-bz-text placeholder-bz-muted border border-bz-border rounded-xl',
            'px-4 py-3 focus:border-bz-primary focus:ring-2 focus:ring-bz-primary/50 focus:outline-none',
            'transition-colors',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {helperText && <span className="text-xs text-bz-muted">{helperText}</span>}
      </label>
    );
  }
);

Input.displayName = 'Input';

export default Input;
