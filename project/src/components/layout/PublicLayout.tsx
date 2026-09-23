import React from 'react';

interface PublicLayoutProps {
  children: React.ReactNode;
  onOpenAuthModal?: (config: { isOpen: boolean; mode: 'login' | 'register' }) => void;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="beezio-public-page min-h-screen text-gray-900">
      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
};

export default PublicLayout;
