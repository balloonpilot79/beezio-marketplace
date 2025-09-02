import React from 'react';

const TestMinimal: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🐝 Beezio.co Test</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600">Test component is working!</p>
        </div>
      </div>
    </div>
  );
};

export default TestMinimal;
