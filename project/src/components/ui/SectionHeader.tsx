import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action, className = '' }) => {
  return (
    <div className={['flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className].join(' ')}>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-bz-text">{title}</h2>
        {subtitle && <p className="text-sm text-bz-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
};

export default SectionHeader;
