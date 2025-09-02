import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Simple Header with inline styles to ensure colors show
const SimpleHeader: React.FC = () => {
  return (
    <header style={{ backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <a href="/" style={{ fontSize: '28px', fontWeight: 'bold', color: '#ea580c', textDecoration: 'none' }}>
              🐝 Beezio
            </a>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '16px' }}>Home</a>
            <a href="/marketplace" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '16px' }}>Marketplace</a>
            <a href="/sellers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '16px' }}>Sellers</a>
            <a href="/affiliates" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '16px' }}>Affiliates</a>
            <a href="/fundraisers" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '16px' }}>Fundraisers</a>
            <button style={{ 
              backgroundColor: '#ea580c', 
              color: 'white', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Sign In
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

// Beautiful Homepage with proper orange colors
const HomePage: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)' }}>
      {/* Hero Section with Orange Gradient */}
      <div style={{ 
        background: 'linear-gradient(90deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
        padding: '96px 0'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '60px', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '24px',
            lineHeight: '1.1'
          }}>
            Welcome to <span style={{ color: '#fef08a' }}>Beezio</span>
          </h1>
          <p style={{ 
            fontSize: '20px', 
            color: '#f3f4f6', 
            marginBottom: '32px', 
            maxWidth: '800px',
            margin: '0 auto 32px auto',
            lineHeight: '1.6'
          }}>
            The revolutionary marketplace that puts sellers first with transparent pricing and recurring affiliate commissions.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={{ 
              backgroundColor: 'white', 
              color: '#ea580c', 
              padding: '16px 32px', 
              borderRadius: '12px', 
              border: 'none',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              🚀 Start Selling Now
            </button>
            <button style={{ 
              backgroundColor: 'transparent', 
              color: 'white', 
              padding: '16px 32px', 
              borderRadius: '12px', 
              border: '2px solid white',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
              💰 Become an Affiliate
            </button>
          </div>
        </div>
      </div>
      
      {/* Benefits Section */}
      <div style={{ padding: '64px 0', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>
              Why Choose Beezio?
            </h2>
            <p style={{ fontSize: '20px', color: '#6b7280' }}>
              The platform that actually cares about your success
            </p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ea580c', marginBottom: '8px' }}>0%</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Platform Fees</div>
              <p style={{ color: '#6b7280' }}>Keep 100% of your profits</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ea580c', marginBottom: '8px' }}>∞</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Recurring Commissions</div>
              <p style={{ color: '#6b7280' }}>Earn forever from every referral</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ea580c', marginBottom: '8px' }}>24/7</div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Support</div>
              <p style={{ color: '#6b7280' }}>We're always here to help</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Marketplace with inline styles
const MarketplacePage: React.FC = () => {
  const sampleProducts = [
    {
      id: 1,
      name: "Wireless Headphones",
      price: 149.99,
      commission: 25,
      image: "https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    {
      id: 2,
      name: "Leather Wallet", 
      price: 89.99,
      commission: 30,
      image: "https://images.pexels.com/photos/1240892/pexels-photo-1240892.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    {
      id: 3,
      name: "Local Honey",
      price: 24.99,
      commission: 20,
      image: "https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=400"
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '32px 0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', marginBottom: '32px' }}>
          Marketplace
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {sampleProducts.map(product => (
            <div key={product.id} style={{ 
              backgroundColor: 'white', 
              borderRadius: '8px', 
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <img 
                src={product.image} 
                alt={product.name} 
                style={{ width: '100%', height: '192px', objectFit: 'cover' }} 
              />
              <div style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#111827' }}>
                  {product.name}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>
                    ${product.price}
                  </span>
                  <span style={{ 
                    backgroundColor: '#dbeafe', 
                    color: '#1d4ed8', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {product.commission}% Commission
                  </span>
                </div>
                <button style={{ 
                  width: '100%', 
                  backgroundColor: '#ea580c', 
                  color: 'white', 
                  padding: '8px 0', 
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}>
                  View Product
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Simple placeholder pages
const SellersPage: React.FC = () => (
  <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '64px 24px' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
        Sellers Page
      </h1>
      <p style={{ fontSize: '18px', color: '#6b7280' }}>
        Start selling on Beezio - Coming Soon!
      </p>
    </div>
  </div>
);

const AffiliatesPage: React.FC = () => (
  <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '64px 24px' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
        Affiliates Page
      </h1>
      <p style={{ fontSize: '18px', color: '#6b7280' }}>
        Join our affiliate program - Coming Soon!
      </p>
    </div>
  </div>
);

const FundraisersPage: React.FC = () => (
  <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '64px 24px' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>
        Fundraisers Page
      </h1>
      <p style={{ fontSize: '18px', color: '#6b7280' }}>
        Community fundraising - Coming Soon!
      </p>
    </div>
  </div>
);

// Main App
const AppMinimal: React.FC = () => {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <SimpleHeader />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/sellers" element={<SellersPage />} />
          <Route path="/affiliates" element={<AffiliatesPage />} />
          <Route path="/fundraisers" element={<FundraisersPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default AppMinimal;
          <nav style={{ marginTop: '10px' }}>
            <a href="/" style={{ color: 'white', margin: '0 20px', textDecoration: 'none' }}>Home</a>
            <a href="/revolutionary" style={{ color: 'white', margin: '0 20px', textDecoration: 'none' }}>Revolutionary</a>
            <a href="/test" style={{ color: 'white', margin: '0 20px', textDecoration: 'none' }}>Test</a>
          </nav>
        </header>
        
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/revolutionary" element={<RevolutionaryPage />} />
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default AppMinimal;
