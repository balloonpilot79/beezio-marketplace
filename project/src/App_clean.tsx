import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Simple Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-orange-600">Beezio</h1>
              </div>
              <nav className="flex space-x-8">
                <a href="/" className="text-gray-700 hover:text-orange-600">Home</a>
                <a href="/marketplace" className="text-gray-700 hover:text-orange-600">Marketplace</a>
                <a href="/dashboard" className="text-gray-700 hover:text-orange-600">Dashboard</a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Beezio Marketplace</h2>
                <p className="text-lg text-gray-600 mb-8">The revolutionary affiliate marketing ecommerce platform</p>
                <div className="bg-white p-8 rounded-lg shadow-md">
                  <h3 className="text-xl font-semibold mb-4">Site is working! ✅</h3>
                  <p className="text-gray-600 mb-4">Basic functionality confirmed:</p>
                  <ul className="text-left max-w-md mx-auto space-y-2">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      React rendering
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Tailwind CSS styling
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Routing system
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Header navigation
                    </li>
                  </ul>
                </div>
              </div>
            } />
            <Route path="/marketplace" element={
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Marketplace Page</h2>
                <p className="text-gray-600">Marketplace functionality will be implemented here</p>
              </div>
            } />
            <Route path="/dashboard" element={
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
                <p className="text-gray-600">User dashboard will be implemented here</p>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
