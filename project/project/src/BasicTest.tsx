import React from 'react';

const BasicTest: React.FC = () => {
  return (
    <div style={{
      padding: '40px',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh',
      fontSize: '24px',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>🐝 Beezio Test Page</h1>
      <p style={{ color: '#666' }}>If you can see this, React is working!</p>
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'white', borderRadius: '8px' }}>
        <p>Server is running on port 5173</p>
        <p>Current time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default BasicTest;
