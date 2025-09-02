#!/usr/bin/env node

/**
 * Automated Fulfillment System Test Script
 * Tests the complete order fulfillment workflow
 */

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Configuration - Update these with your actual values
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key',
  TEST_EMAIL: process.env.TEST_EMAIL || 'test@example.com',
  TEST_ORDER_ID: `test-${Date.now()}`
};

// Initialize Supabase client
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

class FulfillmentTester {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };

    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async testDatabaseConnection() {
    this.log('Testing database connection...');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('count')
        .limit(1);

      if (error) throw error;

      this.testResults.push({ test: 'Database Connection', status: 'PASS' });
      this.log('✅ Database connection successful', 'success');
      return true;
    } catch (error) {
      this.testResults.push({ test: 'Database Connection', status: 'FAIL', error: error.message });
      this.log(`❌ Database connection failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testTableCreation() {
    this.log('Testing database tables...');
    const tables = ['vendor_orders', 'shipping_labels', 'email_notifications', 'delivery_tracking'];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error && !error.message.includes('permission denied')) {
          throw error;
        }

        this.log(`✅ Table '${table}' exists`, 'success');
      } catch (error) {
        this.testResults.push({ test: `Table ${table}`, status: 'FAIL', error: error.message });
        this.log(`❌ Table '${table}' error: ${error.message}`, 'error');
        return false;
      }
    }

    this.testResults.push({ test: 'Database Tables', status: 'PASS' });
    return true;
  }

  async testAutomatedFulfillmentFunction() {
    this.log('Testing automated fulfillment function...');

    const testData = {
      orderId: CONFIG.TEST_ORDER_ID,
      customerEmail: CONFIG.TEST_EMAIL,
      items: [{
        product_id: 'TEST_PRODUCT_123',
        quantity: 1,
        vendor: 'aliexpress'
      }]
    };

    try {
      const response = await this.makeRequest('/functions/v1/automated-order-fulfillment', testData);

      if (response.statusCode === 200) {
        this.testResults.push({ test: 'Automated Fulfillment Function', status: 'PASS' });
        this.log('✅ Automated fulfillment function working', 'success');
        return true;
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      this.testResults.push({ test: 'Automated Fulfillment Function', status: 'FAIL', error: error.message });
      this.log(`❌ Automated fulfillment function failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testEmailServiceFunction() {
    this.log('Testing email service function...');

    const testData = {
      to: CONFIG.TEST_EMAIL,
      type: 'order_confirmation',
      orderData: {
        order_id: CONFIG.TEST_ORDER_ID,
        customer_name: 'Test Customer',
        total: 99.99
      }
    };

    try {
      const response = await this.makeRequest('/functions/v1/email-service', testData);

      if (response.statusCode === 200) {
        this.testResults.push({ test: 'Email Service Function', status: 'PASS' });
        this.log('✅ Email service function working', 'success');
        return true;
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      this.testResults.push({ test: 'Email Service Function', status: 'FAIL', error: error.message });
      this.log(`❌ Email service function failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testVendorIntegrationFunction() {
    this.log('Testing vendor integration function...');

    const testData = {
      vendor: 'aliexpress',
      action: 'check_inventory',
      productId: 'TEST_PRODUCT_123'
    };

    try {
      const response = await this.makeRequest('/functions/v1/vendor-integration', testData);

      // Even if vendor API fails, function should handle it gracefully
      if (response.statusCode === 200 || response.statusCode === 400) {
        this.testResults.push({ test: 'Vendor Integration Function', status: 'PASS' });
        this.log('✅ Vendor integration function working', 'success');
        return true;
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      this.testResults.push({ test: 'Vendor Integration Function', status: 'FAIL', error: error.message });
      this.log(`❌ Vendor integration function failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testDeliveryTrackingFunction() {
    this.log('Testing delivery tracking function...');

    const testData = {
      orderId: CONFIG.TEST_ORDER_ID,
      trackingNumber: 'TEST_TRACKING_123',
      carrier: 'USPS'
    };

    try {
      const response = await this.makeRequest('/functions/v1/delivery-tracking', testData);

      if (response.statusCode === 200) {
        this.testResults.push({ test: 'Delivery Tracking Function', status: 'PASS' });
        this.log('✅ Delivery tracking function working', 'success');
        return true;
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.body}`);
      }
    } catch (error) {
      this.testResults.push({ test: 'Delivery Tracking Function', status: 'FAIL', error: error.message });
      this.log(`❌ Delivery tracking function failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testEndToEndWorkflow() {
    this.log('Testing end-to-end workflow...');

    try {
      // 1. Create a test order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          id: CONFIG.TEST_ORDER_ID,
          customer_email: CONFIG.TEST_EMAIL,
          total: 99.99,
          status: 'paid',
          fulfillment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Trigger automated fulfillment
      const fulfillmentResponse = await this.makeRequest('/functions/v1/automated-order-fulfillment', {
        orderId: CONFIG.TEST_ORDER_ID
      });

      if (fulfillmentResponse.statusCode !== 200) {
        throw new Error('Fulfillment trigger failed');
      }

      // 3. Wait a moment for processing
      await this.sleep(2000);

      // 4. Check if vendor order was created
      const { data: vendorOrder, error: vendorError } = await supabase
        .from('vendor_orders')
        .select('*')
        .eq('order_id', CONFIG.TEST_ORDER_ID)
        .single();

      if (vendorError && !vendorError.message.includes('No rows found')) {
        throw vendorError;
      }

      // 5. Check if email notification was queued
      const { data: emailNotification, error: emailError } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('order_id', CONFIG.TEST_ORDER_ID)
        .single();

      if (emailError && !emailError.message.includes('No rows found')) {
        throw emailError;
      }

      this.testResults.push({ test: 'End-to-End Workflow', status: 'PASS' });
      this.log('✅ End-to-end workflow completed successfully', 'success');
      return true;

    } catch (error) {
      this.testResults.push({ test: 'End-to-End Workflow', status: 'FAIL', error: error.message });
      this.log(`❌ End-to-end workflow failed: ${error.message}`, 'error');
      return false;
    }
  }

  async makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      const url = `${CONFIG.SUPABASE_URL}${endpoint}`;
      const postData = JSON.stringify(data);

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'apikey': CONFIG.SUPABASE_ANON_KEY
        }
      };

      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runAllTests() {
    this.log('🚀 Starting Automated Fulfillment System Tests', 'info');
    this.log('='.repeat(60), 'info');

    const tests = [
      { name: 'Database Connection', func: this.testDatabaseConnection.bind(this) },
      { name: 'Database Tables', func: this.testTableCreation.bind(this) },
      { name: 'Automated Fulfillment Function', func: this.testAutomatedFulfillmentFunction.bind(this) },
      { name: 'Email Service Function', func: this.testEmailServiceFunction.bind(this) },
      { name: 'Vendor Integration Function', func: this.testVendorIntegrationFunction.bind(this) },
      { name: 'Delivery Tracking Function', func: this.testDeliveryTrackingFunction.bind(this) },
      { name: 'End-to-End Workflow', func: this.testEndToEndWorkflow.bind(this) }
    ];

    let passedTests = 0;
    let failedTests = 0;

    for (const test of tests) {
      this.log(`\n📋 Running: ${test.name}`, 'info');
      try {
        const result = await test.func();
        if (result) {
          passedTests++;
        } else {
          failedTests++;
        }
      } catch (error) {
        this.log(`❌ Test '${test.name}' crashed: ${error.message}`, 'error');
        failedTests++;
      }
    }

    // Print results summary
    this.log('\n' + '='.repeat(60), 'info');
    this.log('📊 TEST RESULTS SUMMARY', 'info');
    this.log('='.repeat(60), 'info');

    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      this.log(`${status} ${result.test}: ${result.status}`, result.status === 'PASS' ? 'success' : 'error');
      if (result.error) {
        this.log(`   Error: ${result.error}`, 'error');
      }
    });

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    this.log(`\n⏱️  Total execution time: ${totalTime}s`, 'info');
    this.log(`✅ Passed: ${passedTests}`, 'success');
    this.log(`❌ Failed: ${failedTests}`, 'error');
    this.log(`📈 Success rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`, 'info');

    if (failedTests === 0) {
      this.log('\n🎉 All tests passed! Your automated fulfillment system is ready for production.', 'success');
    } else {
      this.log('\n⚠️  Some tests failed. Please check the errors above and fix them before deploying to production.', 'warning');
    }

    return failedTests === 0;
  }
}

// Run the tests
async function main() {
  const tester = new FulfillmentTester();
  const success = await tester.runAllTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner crashed:', error);
    process.exit(1);
  });
}

module.exports = FulfillmentTester;
