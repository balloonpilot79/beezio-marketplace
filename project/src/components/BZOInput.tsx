import React from 'react';

interface BZOInputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  error?: string;
  label?: string;
  className?: string;
}

const BZOInput: React.FC<BZOInputProps> = ({
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  icon,
  error,
  label,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-bzo-black">
          {label}
          {required && <span className="text-bzo-yellow-primary ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            input-bzo w-full
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-error focus:ring-error' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
      </div>
      
      {error && (
        <p className="text-sm text-error flex items-center gap-1">
          <span>⚠️</span>
          {error}
        </p>
      )}
    </div>
  );
};

export default BZOInput;