import React, { useState } from 'react';
import { useEmailNotifications } from '../hooks/useEmailNotifications';

const EmailNotificationsDemo: React.FC = () => {
  const {
    sendOrderConfirmationEmail,
    sendCommissionEmail,
    sendSaleEmail,
    sendShippingEmail,
    sendCustomEmail,
    loading,
    error
  } = useEmailNotifications();

  const [results, setResults] = useState<Record<string, boolean>>({});

  const handleSendOrderConfirmation = async () => {
    const success = await sendOrderConfirmationEmail(
      'demo-user-id',
      'buyer@example.com',
      {
        orderId: 'ORD-12345',
        items: [
          { name: 'Premium Product', price: 99.99 },
          { name: 'Shipping', price: 9.99 }
        ],
        total: 109.98,
        deliveryDate: 'March 15, 2024',
        shippingAddress: '123 Main St, Anytown, USA',
        trackingUrl: `${window.location.origin}/track/ORD-12345`
      }
    );
    setResults(prev => ({ ...prev, orderConfirmation: success }));
  };

  const handleSendCommission = async () => {
    const success = await sendCommissionEmail(
      'demo-affiliate-id',
      'affiliate@example.com',
      {
        amount: 25.00,
        productName: 'Premium Product',
        rate: 10,
        orderId: 'ORD-12345',
        monthlyTotal: 125.50,
        totalClicks: 450,
        conversionRate: 3.2,
        dashboardUrl: `${window.location.origin}/dashboard`
      }
    );
    setResults(prev => ({ ...prev, commission: success }));
  };

  const handleSendSale = async () => {
    const success = await sendSaleEmail(
      'demo-seller-id',
      'seller@example.com',
      {
        productName: 'Premium Product',
        price: 99.99,
        commission: 9.99,
        orderId: 'ORD-12345',
        customerName: 'John Buyer',
        dashboardUrl: `${window.location.origin}/dashboard`
      }
    );
    setResults(prev => ({ ...prev, sale: success }));
  };

  const handleSendShipping = async () => {
    const success = await sendShippingEmail(
      'demo-buyer-id',
      'buyer@example.com',
      {
        orderId: 'ORD-12345',
        carrier: 'FedEx',
        trackingNumber: '1234567890',
        deliveryDate: 'March 15, 2024',
        trackingUrl: 'https://www.fedex.com/track?tracknumbers=1234567890'
      }
    );
    setResults(prev => ({ ...prev, shipping: success }));
  };

  const handleSendCustom = async () => {
    const success = await sendCustomEmail(
      'demo-user-id',
      'user@example.com',
      'Custom Notification',
      '<h1>Custom Email</h1><p>This is a custom notification email.</p>',
      'marketing_update',
      { customData: 'example' }
    );
    setResults(prev => ({ ...prev, custom: success }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Email Notifications Demo</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Confirmation */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Order Confirmation</h3>
          <p className="text-sm text-gray-600 mb-4">
            Send order confirmation emails to buyers with order details and tracking information.
          </p>
          <button
            onClick={handleSendOrderConfirmation}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Order Confirmation'}
          </button>
          {results.orderConfirmation !== undefined && (
            <p className={`mt-2 text-sm ${results.orderConfirmation ? 'text-green-600' : 'text-red-600'}`}>
              {results.orderConfirmation ? '✅ Email sent successfully!' : '❌ Failed to send email'}
            </p>
          )}
        </div>

        {/* Commission Notification */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Commission Earned</h3>
          <p className="text-sm text-gray-600 mb-4">
            Notify affiliates when they earn commissions from successful sales.
          </p>
          <button
            onClick={handleSendCommission}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Commission Notification'}
          </button>
          {results.commission !== undefined && (
            <p className={`mt-2 text-sm ${results.commission ? 'text-green-600' : 'text-red-600'}`}>
              {results.commission ? '✅ Email sent successfully!' : '❌ Failed to send email'}
            </p>
          )}
        </div>

        {/* Sale Notification */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Product Sold</h3>
          <p className="text-sm text-gray-600 mb-4">
            Notify sellers when their products are sold and commissions are earned.
          </p>
          <button
            onClick={handleSendSale}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Sale Notification'}
          </button>
          {results.sale !== undefined && (
            <p className={`mt-2 text-sm ${results.sale ? 'text-green-600' : 'text-red-600'}`}>
              {results.sale ? '✅ Email sent successfully!' : '❌ Failed to send email'}
            </p>
          )}
        </div>

        {/* Shipping Notification */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Order Shipped</h3>
          <p className="text-sm text-gray-600 mb-4">
            Notify buyers when their orders have been shipped with tracking information.
          </p>
          <button
            onClick={handleSendShipping}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Shipping Notification'}
          </button>
          {results.shipping !== undefined && (
            <p className={`mt-2 text-sm ${results.shipping ? 'text-green-600' : 'text-red-600'}`}>
              {results.shipping ? '✅ Email sent successfully!' : '❌ Failed to send email'}
            </p>
          )}
        </div>

        {/* Custom Email */}
        <div className="p-4 border rounded-lg md:col-span-2">
          <h3 className="text-lg font-semibold mb-3">Custom Email</h3>
          <p className="text-sm text-gray-600 mb-4">
            Send custom emails for special notifications, marketing updates, or support messages.
          </p>
          <button
            onClick={handleSendCustom}
            disabled={loading}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Custom Email'}
          </button>
          {results.custom !== undefined && (
            <p className={`mt-2 text-sm ${results.custom ? 'text-green-600' : 'text-red-600'}`}>
              {results.custom ? '✅ Email sent successfully!' : '❌ Failed to send email'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Implementation Notes</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>• All emails are stored in the database for tracking and analytics</li>
          <li>• Email templates are fully customizable with HTML and CSS</li>
          <li>• Error handling ensures failed emails don't break the application flow</li>
          <li>• Ready for integration with email services like SendGrid, Mailgun, or AWS SES</li>
          <li>• Supports all marketplace activities: orders, sales, commissions, shipping</li>
        </ul>
      </div>
    </div>
  );
};

export default EmailNotificationsDemo;
