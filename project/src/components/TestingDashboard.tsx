import React, { useState } from 'react';
import { testScenarios, runCompleteTest, verifyPlatformRevenue, verifyAffiliateCommissions } from '../utils/realProductTesting';
import { runComprehensiveVerification, testDatabaseConnection, testPaymentCalculations } from '../utils/comprehensiveVerification';
import { runProductionTests, testDatabaseConnectionSafe, testPricingFormula, testBasicFunctionality, testEnvironmentDiagnostics } from '../utils/productionTesting';
import { runDatabaseDiagnostics } from '../utils/advancedDatabaseDiagnostics';
import { verifyTestExecution, quickProofTest } from '../utils/rigorousVerification';

export const TestingDashboard: React.FC = () => {
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [selectedScenario, setSelectedScenario] = useState(0);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async (testFunction: () => Promise<boolean>, testName: string) => {
    setIsRunningTest(true);
    addResult(`🚀 Starting ${testName}...`);
    
    try {
      const success = await testFunction();
      if (success) {
        addResult(`✅ ${testName} completed successfully`);
      } else {
        addResult(`❌ ${testName} failed`);
      }
    } catch (error) {
      addResult(`❌ ${testName} error: ${error}`);
    }
    
    setIsRunningTest(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">🔬 Real Product Testing Dashboard</h1>
            <div className="flex space-x-3">
              <button
                onClick={() => runTest(runCompleteTest, 'Complete Marketplace Test')}
                disabled={isRunningTest}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
              >
                {isRunningTest ? '⏳ Running...' : '🚀 Run Complete Test'}
              </button>
              <button
                onClick={clearResults}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                🗑️ Clear Results
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Test Scenarios */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Test Scenarios</h2>
              <div className="space-y-3">
                {testScenarios.map((scenario, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedScenario === index 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedScenario(index)}
                  >
                    <h3 className="font-medium text-gray-900">{scenario.name}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      <div>Seller: ${scenario.sellerDesiredAmount}</div>
                      <div>Affiliate: {scenario.affiliateRate}% (${scenario.expectedDistribution.affiliate})</div>
                      <div>Customer Pays: ${scenario.expectedDistribution.customer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Scenario Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">💰 Expected Distribution</h2>
              {testScenarios[selectedScenario] && (
                <div className="bg-white rounded-lg p-4 border">
                  <h3 className="font-medium text-gray-900 mb-3">
                    {testScenarios[selectedScenario].name}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Seller Gets:</span>
                      <span className="font-medium text-green-600">
                        ${testScenarios[selectedScenario].expectedDistribution.seller.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Affiliate Commission:</span>
                      <span className="font-medium text-blue-600">
                        ${testScenarios[selectedScenario].expectedDistribution.affiliate.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform Fee:</span>
                      <span className="font-medium text-purple-600">
                        ${testScenarios[selectedScenario].expectedDistribution.platform.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stripe Fee:</span>
                      <span className="font-medium text-orange-600">
                        ${testScenarios[selectedScenario].expectedDistribution.stripe.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-bold">
                        <span className="text-gray-900">Customer Pays:</span>
                        <span className="text-gray-900">
                          ${testScenarios[selectedScenario].expectedDistribution.customer.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Individual Test Buttons */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => runTest(runProductionTests, 'Production Test Suite')}
              disabled={isRunningTest}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium"
            >
              🚀 Production Ready Tests
            </button>
            <button
              onClick={() => runTest(testDatabaseConnectionSafe, 'Safe Database Test')}
              disabled={isRunningTest}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium"
            >
              🔌 Test Database (Safe)
            </button>
            <button
              onClick={() => runTest(() => Promise.resolve(testPricingFormula()), 'Pricing Formula Test')}
              disabled={isRunningTest}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg font-medium"
            >
              🧮 Test Pricing Math
            </button>
            <button
              onClick={() => window.open('https://dashboard.stripe.com/test/payments', '_blank')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-lg font-medium"
            >
              💳 Stripe Dashboard
            </button>
          </div>

          {/* Verification Tests */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-yellow-800 mb-3">🔍 Test Verification (Proof Required)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => runTest(quickProofTest, 'Quick Proof Test')}
                disabled={isRunningTest}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
              >
                ⚡ Quick Proof Test
              </button>
              <button
                onClick={() => runTest(verifyTestExecution, 'Rigorous Verification')}
                disabled={isRunningTest}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
              >
                🔬 Rigorous Verification
              </button>
            </div>
            <p className="text-sm text-yellow-700 mt-2">
              These tests provide detailed proof and won't give false positives
            </p>
          </div>

          {/* Additional Diagnostic Tests */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => runTest(() => Promise.resolve(testEnvironmentDiagnostics()), 'Environment Diagnostics')}
              disabled={isRunningTest}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
            >
              🔍 Environment Diagnostics
            </button>
            <button
              onClick={() => runTest(runDatabaseDiagnostics, 'Advanced Database Diagnostics')}
              disabled={isRunningTest}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
            >
              🚨 Database Deep Dive
            </button>
          </div>

          {/* Test Results */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Test Results</h2>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <div className="text-gray-500">No test results yet. Run a test to see output here.</div>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stripe Test Cards Reference */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">💳 Stripe Test Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-yellow-700">Success:</div>
                <div className="font-mono text-yellow-600">4242424242424242</div>
              </div>
              <div>
                <div className="font-medium text-yellow-700">Declined:</div>
                <div className="font-mono text-yellow-600">4000000000000002</div>
              </div>
              <div>
                <div className="font-medium text-yellow-700">3D Secure:</div>
                <div className="font-mono text-yellow-600">4000002500003155</div>
              </div>
              <div>
                <div className="font-medium text-yellow-700">Insufficient Funds:</div>
                <div className="font-mono text-yellow-600">4000000000009995</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingDashboard;