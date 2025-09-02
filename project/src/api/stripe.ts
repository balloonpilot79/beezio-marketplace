// Temporary local Stripe API for testing
// This will be replaced by Supabase Edge Functions later

export async function createPaymentIntent(
  amount: number,
  items: any[],
  userId?: string,
  billingName?: string,
  billingEmail?: string
) {
  // For now, create a simple payment intent without the full distribution logic
  const response = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // Convert to cents
      items,
      userId,
      billingName,
      billingEmail,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create payment intent');
  }

  return response.json();
}
