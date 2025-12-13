import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, helperText, className = '', children, options, ...props }, ref) => {
    return (
      <label className="block space-y-1.5 text-sm text-bz-muted">
        {label && <span className="font-medium text-bz-text/90">{label}</span>}
        <select
          ref={ref}
          className={[
            'w-full bg-bz-surfaceAlt text-bz-text border border-bz-border rounded-xl',
            'px-4 py-3 focus:border-bz-primary focus:ring-2 focus:ring-bz-primary/50 focus:outline-none',
            'transition-colors',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        {helperText && <span className="text-xs text-bz-muted">{helperText}</span>}
      </label>
    );
  }
);

Select.displayName = 'Select';

export default Select;
