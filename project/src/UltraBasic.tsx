import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Sample Data
const featuredProducts = [
  {
    id: 1,
    name: "Wireless Noise-Cancelling Headphones",
    price: 149.99,
    originalPrice: 199.99,
    commission: 25,
    seller: "TechGear Pro",
    image: "https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=400",
    rating: 4.8,
    reviews: 124
  },
  {
    id: 2,
    name: "Handcrafted Leather Wallet",
    price: 89.99,
    originalPrice: 119.99,
    commission: 30,
    seller: "Sarah's Crafts",
    image: "https://images.pexels.com/photos/1240892/pexels-photo-1240892.jpeg?auto=compress&cs=tinysrgb&w=400",
    rating: 4.9,
    reviews: 89
  },
  {
    id: 3,
    name: "Premium Coffee Subscription",
    price: 29.99,
    originalPrice: 39.99,
    commission: 35,
    seller: "Mountain Roasters",
    image: "https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=400",
    rating: 4.7,
    reviews: 256
  }
];

const activeFundraisers = [
  {
    id: 1,
    title: "Clean Water Wells in Uganda",
    goal: 25000,
    raised: 18750,
    organizer: "Water for Life Foundation",
    image: "https://images.pexels.com/photos/1739855/pexels-photo-1739855.jpeg?auto=compress&cs=tinysrgb&w=400",
    daysLeft: 45
  },
  {
    id: 2,
    title: "Save Local Animal Shelter",
    goal: 15000,
    raised: 8500,
    organizer: "Paws & Hearts Rescue",
    image: "https://images.pexels.com/photos/1851164/pexels-photo-1851164.jpeg?auto=compress&cs=tinysrgb&w=400",
    daysLeft: 23
  }
];

// Header Component with Working Navigation
const Header = () => {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      padding: '24px 40px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <Link to="/" style={{ fontSize: '36px', fontWeight: 'bold', color: '#ea580c', textDecoration: 'none' }}>
        🐝 Beezio.co
      </Link>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        <Link to="/" style={{ color: '#666', textDecoration: 'none', fontSize: '18px', fontWeight: '500' }}>Home</Link>
        <Link to="/marketplace" style={{ color: '#666', textDecoration: 'none', fontSize: '18px', fontWeight: '500' }}>Marketplace</Link>
        <Link to="/sellers" style={{ color: '#666', textDecoration: 'none', fontSize: '18px', fontWeight: '500' }}>Sellers</Link>
        <Link to="/affiliates" style={{ color: '#666', textDecoration: 'none', fontSize: '18px', fontWeight: '500' }}>Affiliates</Link>
        <Link to="/fundraisers" style={{ color: '#666', textDecoration: 'none', fontSize: '18px', fontWeight: '500' }}>Fundraisers</Link>
        <Link to="/login" style={{ 
          backgroundColor: '#ea580c', 
          color: 'white', 
          padding: '12px 24px', 
          border: 'none',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          Sign In
        </Link>
      </div>
    </div>
  );
};

// Dashboard Components
const SellerDashboard = () => {
  const [products, setProducts] = useState([
    { id: 1, name: "Wireless Headphones", price: 149.99, sold: 24, commission: 25, earnings: 899.76 },
    { id: 2, name: "Smart Watch", price: 249.99, sold: 12, commission: 30, earnings: 899.93 }
  ]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111' }}>Seller Dashboard</h1>
          <Link to="/add-product" style={{
            backgroundColor: '#ea580c',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}>
            + Add Product
          </Link>
        </div>
        
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Sales</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>$14,387</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>+23% this month</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Products Sold</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>156</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>+12 this week</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Affiliate Earnings</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6' }}>$2,456</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>Recurring income</div>
          </div>
        </div>

        {/* Products Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111' }}>Your Products</h2>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Product</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Price</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Sold</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Commission</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Earnings</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>{product.name}</td>
                    <td style={{ padding: '16px' }}>${product.price}</td>
                    <td style={{ padding: '16px' }}>{product.sold}</td>
                    <td style={{ padding: '16px' }}>{product.commission}%</td>
                    <td style={{ padding: '16px', color: '#16a34a', fontWeight: 'bold' }}>${product.earnings}</td>
                    <td style={{ padding: '16px' }}>
                      <button style={{ backgroundColor: '#ea580c', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}>
                        Edit
                      </button>
                      <button style={{ backgroundColor: '#f3f4f6', color: '#666', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const AffiliateDashboard = () => {
  const affiliateLinks = [
    { id: 1, product: "Wireless Headphones", link: "beezio.co/aff/abc123", clicks: 156, sales: 24, commission: 899.76 },
    { id: 2, product: "Smart Watch", link: "beezio.co/aff/def456", clicks: 89, sales: 12, commission: 449.88 }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', marginBottom: '40px' }}>Affiliate Dashboard</h1>
        
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Commissions</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>$3,247</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>+18% this month</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Active Links</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3b82f6' }}>24</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>+3 this week</div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Click Rate</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6' }}>8.7%</div>
            <div style={{ fontSize: '12px', color: '#16a34a' }}>Above average</div>
          </div>
        </div>

        {/* Affiliate Links Table */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111' }}>Your Affiliate Links</h2>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Product</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Affiliate Link</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Clicks</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Sales</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Commission</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliateLinks.map(link => (
                  <tr key={link.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>{link.product}</td>
                    <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '14px' }}>{link.link}</td>
                    <td style={{ padding: '16px' }}>{link.clicks}</td>
                    <td style={{ padding: '16px' }}>{link.sales}</td>
                    <td style={{ padding: '16px', color: '#16a34a', fontWeight: 'bold' }}>${link.commission}</td>
                    <td style={{ padding: '16px' }}>
                      <button style={{ backgroundColor: '#ea580c', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}>
                        Copy Link
                      </button>
                      <button style={{ backgroundColor: '#f3f4f6', color: '#666', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        Stats
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const BuyerDashboard = () => {
  const orders = [
    { id: 1, product: "Wireless Headphones", date: "2025-01-28", status: "Delivered", total: 149.99, seller: "TechGear Pro" },
    { id: 2, product: "Smart Watch", date: "2025-01-25", status: "Shipped", total: 249.99, seller: "WearableTech" }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', marginBottom: '40px' }}>Buyer Dashboard</h1>
        
        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <Link to="/marketplace" style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛍️</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111' }}>Shop Products</div>
          </Link>
          <Link to="/fundraisers" style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>❤️</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111' }}>Support Causes</div>
          </Link>
          <Link to="/affiliate-signup" style={{ 
            backgroundColor: 'white', 
            padding: '24px', 
            borderRadius: '12px', 
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111' }}>Earn Commissions</div>
          </Link>
        </div>

        {/* Recent Orders */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111' }}>Recent Orders</h2>
          </div>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Order ID</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Product</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Date</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Total</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: 'bold', color: '#666' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '16px', fontFamily: 'monospace' }}>#{order.id.toString().padStart(6, '0')}</td>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>{order.product}</td>
                    <td style={{ padding: '16px' }}>{order.date}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        backgroundColor: order.status === 'Delivered' ? '#dcfce7' : '#fef3c7',
                        color: order.status === 'Delivered' ? '#16a34a' : '#d97706',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontWeight: 'bold' }}>${order.total}</td>
                    <td style={{ padding: '16px' }}>
                      <button style={{ backgroundColor: '#ea580c', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                        Track
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const CheckoutPage = () => {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [country, setCountry] = useState('US');
  
  const countries = [
    { code: 'US', name: 'United States', currency: 'USD' },
    { code: 'CA', name: 'Canada', currency: 'CAD' },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
    { code: 'AU', name: 'Australia', currency: 'AUD' },
    { code: 'DE', name: 'Germany', currency: 'EUR' }
  ];

  const selectedCountry = countries.find(c => c.code === country);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#111', marginBottom: '40px', textAlign: 'center' }}>
          Secure Checkout
        </h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
          {/* Checkout Form */}
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {/* Country Selection */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#111' }}>
                🌍 Select Your Country
              </h3>
              <select 
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  fontSize: '16px' 
                }}
              >
                {countries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#111' }}>
                💳 Payment Method
              </h3>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="payment" 
                    value="card" 
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  Credit/Debit Card
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="payment" 
                    value="paypal" 
                    checked={paymentMethod === 'paypal'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  PayPal
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="payment" 
                    value="crypto" 
                    checked={paymentMethod === 'crypto'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  Crypto
                </label>
              </div>
            </div>

            {/* Billing Information */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#111' }}>
                📋 Billing Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  placeholder="First Name"
                  style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                />
                <input 
                  type="text" 
                  placeholder="Last Name"
                  style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                />
              </div>
              <input 
                type="email" 
                placeholder="Email Address"
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
              />
              <input 
                type="text" 
                placeholder="Street Address"
                style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px' }}>
                <input 
                  type="text" 
                  placeholder="City"
                  style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                />
                <input 
                  type="text" 
                  placeholder="State/Province"
                  style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                />
                <input 
                  type="text" 
                  placeholder="ZIP/Postal"
                  style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Card Information */}
            {paymentMethod === 'card' && (
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#111' }}>
                  💳 Card Information
                </h3>
                <input 
                  type="text" 
                  placeholder="Card Number"
                  style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '16px' }}>
                  <input 
                    type="text" 
                    placeholder="MM/YY"
                    style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                  />
                  <input 
                    type="text" 
                    placeholder="CVC"
                    style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                  />
                  <input 
                    type="text" 
                    placeholder="ZIP"
                    style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
                  />
                </div>
              </div>
            )}

            <button style={{
              width: '100%',
              backgroundColor: '#ea580c',
              color: 'white',
              padding: '16px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
              Complete Purchase ({selectedCountry?.currency} 149.99)
            </button>
          </div>

          {/* Order Summary */}
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', height: 'fit-content' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', color: '#111' }}>
              Order Summary
            </h3>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <img 
                  src="https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=100" 
                  alt="Product" 
                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', marginRight: '12px' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Wireless Noise-Cancelling Headphones</div>
                  <div style={{ color: '#666', fontSize: '14px' }}>by TechGear Pro</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Subtotal:</span>
              <span>{selectedCountry?.currency} 149.99</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Shipping:</span>
              <span>Free</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Tax:</span>
              <span>{selectedCountry?.currency} 12.00</span>
            </div>
            <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}>
                <span>Total:</span>
                <span>{selectedCountry?.currency} 161.99</span>
              </div>
            </div>
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '14px', color: '#16a34a' }}>
                ✅ Secure checkout with 256-bit SSL encryption<br/>
                ✅ 30-day money-back guarantee<br/>
                ✅ Free worldwide shipping
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '48px', borderRadius: '16px', boxShadow: '0 12px 24px rgba(0,0,0,0.1)', width: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#ea580c', marginBottom: '8px' }}>🐝</div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111', marginBottom: '8px' }}>
            {isSignUp ? 'Join Beezio.co' : 'Welcome Back'}
          </h1>
          <p style={{ color: '#666' }}>
            {isSignUp ? 'Start your success story today' : 'Sign in to your account'}
          </p>
        </div>

        <form>
          {isSignUp && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <input 
                type="text" 
                placeholder="First Name"
                style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
              />
              <input 
                type="text" 
                placeholder="Last Name"
                style={{ padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px' }}
              />
            </div>
          )}
          <input 
            type="email" 
            placeholder="Email Address"
            style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
          />
          <input 
            type="password" 
            placeholder="Password"
            style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
          />
          {isSignUp && (
            <input 
              type="password" 
              placeholder="Confirm Password"
              style={{ width: '100%', padding: '12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '16px', marginBottom: '16px' }}
            />
          )}
          
          <button type="submit" style={{
            width: '100%',
            backgroundColor: '#ea580c',
            color: 'white',
            padding: '16px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '16px'
          }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#ea580c', 
              cursor: 'pointer', 
              fontSize: '16px' 
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>

        {isSignUp && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '14px', color: '#16a34a', textAlign: 'center' }}>
              🎉 Join thousands of successful sellers<br/>
              📈 Start earning from day one<br/>
              💰 Zero platform fees forever
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
  const [showChat, setShowChat] = useState(false);

  return (
    <div>
      {/* Enhanced Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 30%, #dc2626 70%, #b91c1c 100%)',
        padding: '120px 40px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          fontSize: '120px',
          opacity: '0.1',
          color: 'white'
        }}>🐝</div>
        
        <h1 style={{ 
          fontSize: '72px', 
          fontWeight: 'bold', 
          color: 'white', 
          marginBottom: '24px',
          margin: '0 0 24px 0',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          Welcome to <span style={{ color: '#fef08a' }}>Beezio.co</span>
        </h1>
        <p style={{ 
          fontSize: '24px', 
          color: '#f3f4f6', 
          marginBottom: '16px',
          margin: '0 0 16px 0',
          fontWeight: '500'
        }}>
          The Revolutionary Global Marketplace That Actually Cares About Your Success
        </p>
        <p style={{ 
          fontSize: '18px', 
          color: '#e5e7eb', 
          marginBottom: '40px',
          margin: '0 0 40px 0',
          maxWidth: '800px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Transparent pricing • Recurring affiliate commissions • Zero platform fees • Multi-country support
        </p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/seller-signup" style={{ 
            backgroundColor: 'white', 
            color: '#ea580c', 
            padding: '18px 36px', 
            borderRadius: '12px', 
            textDecoration: 'none',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}>
            🚀 Start Selling Now
          </Link>
          <Link to="/affiliate-signup" style={{ 
            backgroundColor: 'transparent', 
            color: 'white', 
            padding: '18px 36px', 
            borderRadius: '12px', 
            border: '3px solid white',
            fontSize: '18px',
            fontWeight: 'bold',
            textDecoration: 'none'
          }}>
            💰 Become an Affiliate
          </Link>
        </div>
      </div>

      {/* Featured Products Section */}
      <div style={{ backgroundColor: 'white', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '42px', fontWeight: 'bold', color: '#111', marginBottom: '16px' }}>
              🔥 Featured Products
            </h2>
            <p style={{ fontSize: '18px', color: '#666' }}>
              Top-earning products with high commission rates
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '30px' }}>
            {featuredProducts.map(product => {
              const savings = product.originalPrice - product.price;
              const progressPercent = (product.commission / 50) * 100;
              
              return (
                <div key={product.id} style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '16px', 
                  boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    zIndex: 1
                  }}>
                    Save ${savings.toFixed(2)}
                  </div>
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    style={{ width: '100%', height: '240px', objectFit: 'cover' }} 
                  />
                  <div style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#111' }}>
                      {product.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#fbbf24', marginRight: '8px' }}>★★★★★</span>
                      <span style={{ fontSize: '14px', color: '#666' }}>{product.rating} ({product.reviews} reviews)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#16a34a' }}>
                        ${product.price}
                      </span>
                      <span style={{ fontSize: '18px', color: '#9ca3af', textDecoration: 'line-through' }}>
                        ${product.originalPrice}
                      </span>
                    </div>
                    <div style={{ 
                      backgroundColor: '#f3f4f6', 
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ea580c' }}>
                          {product.commission}% Commission
                        </span>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          Earn ${(product.price * product.commission / 100).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '4px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          backgroundColor: '#ea580c',
                          borderRadius: '2px'
                        }}></div>
                      </div>
                    </div>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                      By {product.seller}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/product/${product.id}`} style={{
                        flex: 1,
                        backgroundColor: '#ea580c',
                        color: 'white',
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        textDecoration: 'none',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}>
                        View Product
                      </Link>
                      <button style={{
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}>
                        🔗
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/marketplace" style={{
              backgroundColor: '#ea580c',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              View All Products →
            </Link>
          </div>
        </div>
      </div>

      {/* Active Fundraisers Section */}
      <div style={{ backgroundColor: '#f9fafb', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h2 style={{ fontSize: '42px', fontWeight: 'bold', color: '#111', marginBottom: '16px' }}>
              ❤️ Community Fundraisers
            </h2>
            <p style={{ fontSize: '18px', color: '#666' }}>
              Support meaningful causes while building your network
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
            {activeFundraisers.map(fundraiser => {
              const progressPercent = (fundraiser.raised / fundraiser.goal) * 100;
              
              return (
                <div key={fundraiser.id} style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '16px', 
                  boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  <img 
                    src={fundraiser.image} 
                    alt={fundraiser.title} 
                    style={{ width: '100%', height: '200px', objectFit: 'cover' }} 
                  />
                  <div style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', color: '#111' }}>
                      {fundraiser.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                      By {fundraiser.organizer}
                    </p>
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#16a34a' }}>
                          ${fundraiser.raised.toLocaleString()} raised
                        </span>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          ${fundraiser.goal.toLocaleString()} goal
                        </span>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '8px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(progressPercent, 100)}%`,
                          height: '100%',
                          backgroundColor: '#16a34a',
                          borderRadius: '4px'
                        }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          {progressPercent.toFixed(1)}% funded
                        </span>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          {fundraiser.daysLeft} days left
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/fundraiser/${fundraiser.id}`} style={{
                        flex: 1,
                        backgroundColor: '#16a34a',
                        color: 'white',
                        padding: '12px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        textDecoration: 'none',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}>
                        Donate Now
                      </Link>
                      <button style={{
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}>
                        📤
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/fundraisers" style={{
              backgroundColor: '#16a34a',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              View All Fundraisers →
            </Link>
          </div>
        </div>
      </div>

      {/* Global Reach Section */}
      <div style={{ backgroundColor: 'white', padding: '80px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '42px', fontWeight: 'bold', color: '#111', marginBottom: '20px' }}>
            🌍 Global Marketplace
          </h2>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '40px' }}>
            Sell and earn across multiple countries with local currency support
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🇺🇸</div>
              <div style={{ fontWeight: 'bold' }}>United States</div>
              <div style={{ color: '#666', fontSize: '14px' }}>USD Support</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🇨🇦</div>
              <div style={{ fontWeight: 'bold' }}>Canada</div>
              <div style={{ color: '#666', fontSize: '14px' }}>CAD Support</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🇬🇧</div>
              <div style={{ fontWeight: 'bold' }}>United Kingdom</div>
              <div style={{ color: '#666', fontSize: '14px' }}>GBP Support</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🇪🇺</div>
              <div style={{ fontWeight: 'bold' }}>European Union</div>
              <div style={{ color: '#666', fontSize: '14px' }}>EUR Support</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🇦🇺</div>
              <div style={{ fontWeight: 'bold' }}>Australia</div>
              <div style={{ color: '#666', fontSize: '14px' }}>AUD Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Bot */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <button
          onClick={() => setShowChat(!showChat)}
          style={{
            backgroundColor: '#ea580c',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          💬
        </button>
        
        {showChat && (
          <div style={{
            position: 'absolute',
            bottom: '70px',
            right: '0',
            width: '320px',
            height: '400px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              backgroundColor: '#ea580c',
              color: 'white',
              padding: '16px',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              fontWeight: 'bold'
            }}>
              🐝 Beezio Support
            </div>
            <div style={{
              flex: 1,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>👋</div>
              <p style={{ marginBottom: '16px', color: '#333' }}>
                Hi! I'm here to help you get started with Beezio.co
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
                Ask me about:
              </p>
              <div style={{ textAlign: 'left', fontSize: '14px', color: '#666' }}>
                • Setting up your seller dashboard<br/>
                • Affiliate programs & commissions<br/>
                • Multi-country selling<br/>
                • Checkout & payment processing<br/>
                • Supabase integration
              </div>
            </div>
            <div style={{
              padding: '16px',
              borderTop: '1px solid #eee'
            }}>
              <input
                type="text"
                placeholder="Type your message..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component with Routing
function UltraBasic() {
  return (
    <Router>
      <div>
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/marketplace" element={<div style={{ padding: '40px', textAlign: 'center' }}>🛍️ Marketplace Coming Soon</div>} />
          <Route path="/sellers" element={<SellerDashboard />} />
          <Route path="/affiliates" element={<AffiliateDashboard />} />
          <Route path="/buyers" element={<BuyerDashboard />} />
          <Route path="/fundraisers" element={<div style={{ padding: '40px', textAlign: 'center' }}>❤️ Fundraisers Coming Soon</div>} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/seller-signup" element={<LoginPage />} />
          <Route path="/affiliate-signup" element={<LoginPage />} />
          <Route path="/add-product" element={<div style={{ padding: '40px', textAlign: 'center' }}>📦 Add Product Coming Soon</div>} />
          <Route path="/product/:id" element={<div style={{ padding: '40px', textAlign: 'center' }}>📱 Product Details Coming Soon</div>} />
          <Route path="/fundraiser/:id" element={<div style={{ padding: '40px', textAlign: 'center' }}>❤️ Fundraiser Details Coming Soon</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default UltraBasic;
