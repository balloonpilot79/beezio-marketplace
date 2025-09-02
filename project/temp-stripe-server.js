import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, items, userId, billingName, billingEmail } = req.body;

    // Create payment intent with metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        userId: userId || 'anonymous',
        billingName: billingName || '',
        billingEmail: billingEmail || '',
        items: JSON.stringify(items),
      },
    });

    res.json({
      client_secret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

app.listen(port, () => {
  console.log(`Temporary Stripe server running on http://localhost:${port}`);
});
