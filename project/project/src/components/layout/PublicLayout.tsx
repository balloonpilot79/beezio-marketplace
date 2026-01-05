import React from 'react';

interface PublicLayoutProps {
  children: React.ReactNode;
  onOpenAuthModal?: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-6xl mx-auto px-4 py-10">{children}</main>
    </div>
  );
};

export default PublicLayout;
