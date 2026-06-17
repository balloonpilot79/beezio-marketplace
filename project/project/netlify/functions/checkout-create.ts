import type { Handler } from '@netlify/functions';
import { handler as paypalCreateOrderHandler } from './paypal-create-order';

// Legacy endpoint compatibility.
// Route /api/checkout/create now forwards to the PayPal order creator.
export const handler: Handler = async (event, context) => {
  return paypalCreateOrderHandler(event, context);
};

export default handler;
