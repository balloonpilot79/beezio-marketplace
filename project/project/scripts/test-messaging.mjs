import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in env to run messaging tests.');
  process.exit(1);
}

const buyerUser = { email: 'e2e-buyer@test.beezio.co', password: 'Testpass123!' };
const sellerUser = { email: 'e2e-seller@test.beezio.co', password: 'Testpass123!' };
const adminUser = {
  email: process.env.MESSAGING_ADMIN_EMAIL || '',
  password: process.env.MESSAGING_ADMIN_PASSWORD || '',
};

const createAuthedClient = async (email, password) => {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new Error(`Sign in failed for ${email}: ${error?.message || 'no session'}`);
  }
  return client;
};

const resolveSellerId = async (client) => {
  const { data, error } = await client
    .from('profiles')
    .select('user_id')
    .eq('email', sellerUser.email)
    .maybeSingle();
  if (error) throw error;
  if (!data?.user_id) throw new Error('Unable to resolve seller user_id');
  return String(data.user_id);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const invokeEdge = async (client, name, body) => {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    const status = error?.context?.status;
    const detail = error?.message || 'Unknown edge function error';
    throw new Error(`Function ${name} failed${status ? ` (${status})` : ''}: ${detail}`);
  }
  return data;
};

const run = async () => {
  console.log('Messaging E2E: starting');

  const buyerClient = await createAuthedClient(buyerUser.email, buyerUser.password);
  const sellerId = await resolveSellerId(buyerClient);

  const createData = await invokeEdge(buyerClient, 'create-dispute-thread', {
    sellerId,
    disputeType: 'refund_request',
    description: 'E2E messaging test - refund request',
    message: 'Buyer message: requesting refund and support review.',
    orderId: null,
  });
  const disputeId = createData?.dispute?.id;
  assert(disputeId, 'create-dispute-thread did not return dispute id');

  await invokeEdge(buyerClient, 'send-dispute-message', {
    disputeId,
    body: 'Buyer follow-up: additional details.',
  });

  const { data: buyerMessages, error: buyerFetchError } = await buyerClient
    .from('dispute_messages')
    .select('id, message')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (buyerFetchError) throw buyerFetchError;
  assert((buyerMessages || []).length >= 2, 'Buyer cannot read dispute messages');

  const sellerClient = await createAuthedClient(sellerUser.email, sellerUser.password);
  await invokeEdge(sellerClient, 'send-dispute-message', {
    disputeId,
    body: 'Seller response: investigating and requesting more info.',
  });

  const { data: sellerMessages, error: sellerFetchError } = await sellerClient
    .from('dispute_messages')
    .select('id, message')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });
  if (sellerFetchError) throw sellerFetchError;
  assert((sellerMessages || []).length >= 3, 'Seller cannot read dispute messages');

  if (adminUser.email && adminUser.password) {
    const adminClient = await createAuthedClient(adminUser.email, adminUser.password);
    const { data: adminDispute, error: adminDisputeErr } = await adminClient
      .from('disputes')
      .select('id')
      .eq('id', disputeId)
      .maybeSingle();
    if (adminDisputeErr) throw adminDisputeErr;
    assert(adminDispute?.id, 'Admin cannot view dispute');
    const { data: adminMessages, error: adminMsgErr } = await adminClient
      .from('dispute_messages')
      .select('id')
      .eq('dispute_id', disputeId);
    if (adminMsgErr) throw adminMsgErr;
    assert((adminMessages || []).length >= 3, 'Admin cannot view dispute messages');
    console.log('Admin access verified.');
  } else {
    console.log('Admin check skipped (set MESSAGING_ADMIN_EMAIL + MESSAGING_ADMIN_PASSWORD to enable).');
  }

  console.log('Messaging E2E: passed');
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Messaging E2E failed:', err?.message || err);
    process.exit(1);
  });
