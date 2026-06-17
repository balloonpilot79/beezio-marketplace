import React from 'react';
import { getPartnerProgramLabel } from '../utils/processorSafeCopy';

const HomePage: React.FC<{
  onOpenAuthModal: (modal: { isOpen: boolean; mode: 'login' | 'register' }) => void;
  onOpenSimpleSignup: () => void;
}> = ({ onOpenAuthModal, onOpenSimpleSignup }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
            Shop Smart, Sell Confidently
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Beezio is a retail marketplace for physical goods with secure checkout and clear pricing. Learn more about the {getPartnerProgramLabel()} or start selling today.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={onOpenSimpleSignup}
              className="bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-black px-8 py-4 rounded-full font-bold transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              → Get Started
            </button>
            <button
              onClick={() => onOpenAuthModal({ isOpen: true, mode: 'login' })}
              className="bg-white text-purple-600 px-8 py-4 rounded-full font-bold border-2 border-purple-600 hover:bg-purple-600 hover:text-white transition-all duration-200"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
