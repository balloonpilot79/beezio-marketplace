import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

const HomePage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Beezio</h1>
      <p className="mb-6 text-gray-600">Buy, sell, and earn with full transparency.</p>
      <div className="flex gap-4 justify-center">
        <Link to="/marketplace" className="px-6 py-3 bg-yellow-400 rounded-full font-bold">Marketplace</Link>
        <a href="https://beezio.co" className="px-6 py-3 bg-gray-200 rounded-full">beezio.co</a>
      </div>
    </div>
  </div>
);

const App: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  </Router>
);

export default App;
