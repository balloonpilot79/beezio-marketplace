import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';

// Beezio sellers pack and ship their own goods. Keep legacy automation routes
// closed so old clients and integrations cannot place supplier orders.
export const handler: Handler = async () => json(409, {
  ok: false,
  manual_only: true,
  error: 'Automatic fulfillment is disabled. Sellers manage shipping in Business Center > Orders.',
});

export default handler;
