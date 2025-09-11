# Email Notification System Documentation

## Overview

The Beezio marketplace now includes a comprehensive email notification system that automatically sends emails for all marketplace activities. This system handles welcome emails, order confirmations, commission notifications, sale alerts, shipping updates, and custom notifications.

## Features

### 🎯 Automated Email Triggers
- **Welcome Emails**: Sent automatically when new users sign up
- **Order Confirmations**: Sent to buyers when orders are placed
- **Commission Notifications**: Sent to affiliates when they earn commissions
- **Sale Notifications**: Sent to sellers when their products are sold
- **Shipping Updates**: Sent to buyers when orders ship
- **Custom Emails**: For marketing, support, and special announcements

### 📊 Email Tracking & Analytics
- All emails are stored in the database with full metadata
- Track delivery status, user engagement, and email types
- Comprehensive logging for debugging and analytics

### 🎨 Professional Email Templates
- Beautiful, responsive HTML templates
- Beezio branding and color scheme
- Mobile-optimized design
- Dynamic content insertion

## Database Setup

Run the `EMAIL_NOTIFICATIONS_SETUP.sql` file to create the necessary database table:

```sql
-- Creates email_notifications table with proper indexes and RLS policies
-- Run this in your Supabase SQL editor
```

## File Structure

```
src/
├── services/
│   └── emailService.ts          # Core email service with templates
├── hooks/
│   └── useEmailNotifications.ts # React hook for easy email sending
├── components/
│   └── EmailNotificationsDemo.tsx # Demo component for testing
└── contexts/
    └── AuthContextMultiRole.tsx  # Updated with welcome email integration
```

## Usage Examples

### Using the Email Hook

```tsx
import { useEmailNotifications } from '../hooks/useEmailNotifications';

const MyComponent = () => {
  const {
    sendOrderConfirmationEmail,
    sendCommissionEmail,
    sendSaleEmail,
    sendShippingEmail,
    loading,
    error
  } = useEmailNotifications();

  const handleOrderPlaced = async (orderData) => {
    const success = await sendOrderConfirmationEmail(
      userId,
      userEmail,
      {
        orderId: 'ORD-12345',
        items: [{ name: 'Product', price: 99.99 }],
        total: 99.99,
        deliveryDate: 'March 15, 2024',
        shippingAddress: '123 Main St',
        trackingUrl: `${window.location.origin}/track/ORD-12345`
      }
    );

    if (success) {
      console.log('Order confirmation email sent!');
    }
  };

  return (
    <button onClick={handleOrderPlaced} disabled={loading}>
      {loading ? 'Sending...' : 'Place Order'}
    </button>
  );
};
```

### Direct Service Usage

```tsx
import { sendOrderNotificationEmails } from '../hooks/useEmailNotifications';

// Send both buyer confirmation and seller notification
const result = await sendOrderNotificationEmails(
  buyerId, buyerEmail, sellerId, sellerEmail,
  orderData, productData
);
```

## Email Templates

### Welcome Email
- Sent to new users upon registration
- Includes dashboard link and next steps
- Branded with Beezio colors and messaging

### Order Confirmation
- Detailed order summary with items and pricing
- Delivery date and shipping address
- Tracking link for order monitoring

### Commission Earned
- Commission amount and product details
- Monthly earnings summary
- Performance metrics (clicks, conversion rate)

### Product Sold
- Sale details and commission earned
- Customer information
- Dashboard link for order management

### Order Shipped
- Shipping carrier and tracking number
- Estimated delivery date
- Direct tracking link

## Integration Points

### Authentication Flow
- Welcome emails are automatically sent during user registration
- Integrated into `AuthContextMultiRole.tsx`

### Order Processing
```tsx
// When an order is placed
await sendOrderNotificationEmails(
  buyerId, buyerEmail, sellerId, sellerEmail,
  orderData, productData
);

// When order ships
await sendShippingNotification(buyerId, buyerEmail, shippingData);
```

### Commission System
```tsx
// When commission is earned
await sendCommissionNotification(
  affiliateId, affiliateEmail, commissionData
);
```

## Configuration

### Environment Variables
Add these to your environment configuration:

```env
# Email Service Configuration (for production)
EMAIL_SERVICE_API_KEY=your_email_service_api_key
EMAIL_FROM=noreply@beezio.co
EMAIL_SERVICE_PROVIDER=sendgrid  # or mailgun, aws-ses, etc.
```

### Production Email Service Integration

Replace the placeholder in `emailService.ts`:

```tsx
// TODO: Integrate with actual email service
// Example: SendGrid integration
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: emailData.to,
  from: process.env.EMAIL_FROM,
  subject: emailData.subject,
  html: emailData.html,
};

await sgMail.send(msg);
```

## Testing

### Demo Component
Use the `EmailNotificationsDemo` component to test all email types:

```tsx
import EmailNotificationsDemo from '../components/EmailNotificationsDemo';

// Add to any page for testing
<EmailNotificationsDemo />
```

### Manual Testing
1. Sign up a new user → Welcome email should be sent
2. Place an order → Order confirmation and sale notification sent
3. Mark order as shipped → Shipping notification sent
4. Commission earned → Commission notification sent

## Security & Privacy

### Row Level Security (RLS)
- Users can only view their own email notifications
- Service role handles email sending operations
- Proper authentication checks in place

### Data Protection
- Email content stored securely in database
- User data handled according to privacy policies
- No sensitive information exposed in email templates

## Monitoring & Maintenance

### Email Logs
Check the `email_notifications` table for:
- Delivery status of all emails
- Error messages for failed sends
- User engagement metrics
- Email type distribution

### Performance
- Emails sent asynchronously to avoid blocking UI
- Proper error handling prevents application crashes
- Database indexes optimize query performance

## Future Enhancements

### Planned Features
- Email preferences management for users
- Bulk email campaigns for marketing
- Email analytics dashboard
- A/B testing for email templates
- Integration with email marketing platforms

### Scalability
- Queue system for high-volume email sending
- Template caching for better performance
- Multi-region email delivery
- Advanced personalization features

## Troubleshooting

### Common Issues
1. **Emails not sending**: Check database connection and email service configuration
2. **Template errors**: Verify all required data is provided to email functions
3. **Authentication errors**: Ensure proper RLS policies and user permissions

### Debug Mode
Enable debug logging in development:

```tsx
// In emailService.ts
console.log('📧 Sending email:', emailData);
```

## Support

For questions or issues with the email notification system:
1. Check this documentation first
2. Review the demo component for usage examples
3. Check database logs for email delivery status
4. Contact the development team for technical support

---

**Last Updated**: March 2024
**Version**: 1.0.0
**Maintainer**: Beezio Development Team
