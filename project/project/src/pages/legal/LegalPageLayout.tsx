import React from 'react';
import PublicLayout from '../../components/layout/PublicLayout';

interface LegalPageLayoutProps {
  title: string;
  updated?: string;
  children: React.ReactNode;
}

const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({ title, updated, children }) => (
  <PublicLayout>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{title}</h1>
        {updated && <p className="text-sm text-gray-500 mt-2">Last updated: {updated}</p>}
      </header>
      <div className="space-y-6 text-sm sm:text-base text-gray-700">{children}</div>
    </div>
  </PublicLayout>
);

export default LegalPageLayout;
