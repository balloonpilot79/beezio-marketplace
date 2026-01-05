import React from 'react';

const SimpleApp: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: 'blue', 
      color: 'white', 
      padding: '50px', 
      fontSize: '24px',
      textAlign: 'center',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>🚀 BEEZIO IS WORKING! 🚀</h1>
      <p>This is the simplified version to test if React is working</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
      <div style={{ marginTop: '30px' }}>
        <h2>✅ Server Status: RUNNING</h2>
        <h2>✅ React Status: WORKING</h2>
        <h2>✅ Routing Status: TESTING</h2>
      </div>
    </div>
  );
};

export default SimpleApp;
