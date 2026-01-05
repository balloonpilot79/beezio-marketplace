import { useState } from 'react';
import {
  emailService,
  sendOrderConfirmation,
  sendCommissionNotification,
  sendSaleNotification,
  sendShippingNotification
} from '../services/emailService';

interface UseEmailNotificationsReturn {
  sendOrderConfirmationEmail: (userId: string, email: string, orderData: any) => Promise<boolean>;
  sendCommissionEmail: (userId: string, email: string, commissionData: any) => Promise<boolean>;
  sendSaleEmail: (userId: string, email: string, saleData: any) => Promise<boolean>;
  sendShippingEmail: (userId: string, email: string, shippingData: any) => Promise<boolean>;
  sendCustomEmail: (userId: string, email: string, subject: string, htmlContent: string, type: string, metadata?: any) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export const useEmailNotifications = (): UseEmailNotificationsReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailOperation = async (operation: () => Promise<boolean>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Email operation failed:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendOrderConfirmationEmail = async (
    userId: string,
    email: string,
    orderData: any
  ): Promise<boolean> => {
    return handleEmailOperation(() => sendOrderConfirmation(userId, email, orderData));
  };

  const sendCommissionEmail = async (
    userId: string,
    email: string,
    commissionData: any
  ): Promise<boolean> => {
    return handleEmailOperation(() => sendCommissionNotification(userId, email, commissionData));
  };

  const sendSaleEmail = async (
    userId: string,
    email: string,
    saleData: any
  ): Promise<boolean> => {
    return handleEmailOperation(() => sendSaleNotification(userId, email, saleData));
  };

  const sendShippingEmail = async (
    userId: string,
    email: string,
    shippingData: any
  ): Promise<boolean> => {
    return handleEmailOperation(() => sendShippingNotification(userId, email, shippingData));
  };

  const sendCustomEmail = async (
    userId: string,
    email: string,
    subject: string,
    htmlContent: string,
    type: string,
    metadata?: any
  ): Promise<boolean> => {
    return handleEmailOperation(() =>
      emailService.sendCustomEmail(userId, email, subject, htmlContent, type as any, metadata)
    );
  };

  return {
    sendOrderConfirmationEmail,
    sendCommissionEmail,
    sendSaleEmail,
    sendShippingEmail,
    sendCustomEmail,
    loading,
    error
  };
};

// Utility functions for common email scenarios
export const sendOrderNotificationEmails = async (
  buyerId: string,
  buyerEmail: string,
  sellerId: string,
  sellerEmail: string,
  orderData: any,
  productData: any
) => {
  const results = await Promise.allSettled([
    // Send order confirmation to buyer
    sendOrderConfirmation(buyerId, buyerEmail, orderData),

    // Send sale notification to seller
    sendSaleNotification(sellerId, sellerEmail, {
      productName: productData.name,
      price: productData.price,
      commission: (productData.price * 0.1), // 10% commission
      orderId: orderData.orderId,
      customerName: buyerEmail.split('@')[0],
      dashboardUrl: `${window.location.origin}/dashboard`
    })
  ]);

  return {
    buyerEmailSent: results[0].status === 'fulfilled' ? results[0].value : false,
    sellerEmailSent: results[1].status === 'fulfilled' ? results[1].value : false
  };
};

export const sendCommissionAndShippingEmails = async (
  affiliateId: string,
  affiliateEmail: string,
  buyerId: string,
  buyerEmail: string,
  commissionData: any,
  shippingData: any
) => {
  const results = await Promise.allSettled([
    // Send commission notification to affiliate
    sendCommissionNotification(affiliateId, affiliateEmail, commissionData),

    // Send shipping notification to buyer
    sendShippingNotification(buyerId, buyerEmail, shippingData)
  ]);

  return {
    commissionEmailSent: results[0].status === 'fulfilled' ? results[0].value : false,
    shippingEmailSent: results[1].status === 'fulfilled' ? results[1].value : false
  };
};
