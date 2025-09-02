import React from 'react';

const TestPage: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: 'red', 
      color: 'white', 
      padding: '50px', 
      fontSize: '24px',
      textAlign: 'center',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>🚀 TEST PAGE IS WORKING! 🚀</h1>
      <p>If you can see this red page, React is working!</p>
      <p>Current time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
};

export default TestPage;
