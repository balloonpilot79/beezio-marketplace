import React from 'react';

const TestBasic: React.FC = () => {
  return (
    <div style={{ padding: '20px', background: 'red', color: 'white' }}>
      <h1>BASIC TEST WORKING - Server is running!</h1>
      <p>If you can see this, the server is working properly.</p>
      <p>Current time: {new Date().toLocaleString()}</p>
    </div>
  );
};

export default TestBasic;
