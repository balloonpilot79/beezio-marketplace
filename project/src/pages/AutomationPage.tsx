import React from 'react';
import { Link } from 'react-router-dom';
import AutomationShowcase from '../components/AutomationShowcase';

const AutomationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                <span className="text-lg">🐝</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Beezio</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Home
              </Link>
              <Link
                to="/marketplace"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Marketplace
              </Link>
              <Link
                to="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <AutomationShowcase />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                <span className="text-lg">🐝</span>
              </div>
              <span className="text-xl font-bold">Beezio</span>
            </div>
            <p className="text-gray-400 mb-4">
              Empowering sellers, affiliates, and communities to thrive together.
            </p>
            <p className="text-sm text-gray-500">
              © 2024 Beezio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AutomationPage;
