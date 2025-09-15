import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in env to run this flow.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function nowName() {
  return String(Date.now()).slice(-6);
}

async function run() {
  const stamp = nowName();
  const email = `e2e-seller-${stamp}@test.beezio.co`;
  const password = `Testpass123!`;
  const newPassword = password + 'X1!';

  console.log('Test email:', email);

  // Sign up
  console.log('Signing up...');
  const signupRes = await supabase.auth.signUp({ email, password });
  if (signupRes.error) {
    console.warn('Sign up returned error:', signupRes.error.message || signupRes.error);
    // try sign in if already exists
    if (!String(signupRes.error.message || '').includes('already')) {
      console.error('Sign up failed, aborting');
      process.exit(2);
    }
    console.log('User may already exist; attempting sign in...');
  } else {
    console.log('Sign up OK.');
  }

  // Sign in
  console.log('Signing in with initial password...');
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.error('Sign in failed:', signInErr.message || signInErr);
    process.exit(3);
  }
  console.log('Sign in successful. Session present:', !!signInData?.session);

  const userId = signInData?.user?.id;
  if (!userId) {
    console.error('No user id after sign in; aborting');
    process.exit(4);
  }

  // Ensure profile exists
  try {
    const { data: existing } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
    if (!existing) {
      const { error: pErr } = await supabase.from('profiles').insert({ user_id: userId, email, full_name: 'E2E Seller' });
      if (pErr) console.warn('Profile insert warning:', pErr.message || pErr);
      else console.log('Profile created');
    } else {
      console.log('Profile exists');
    }
  } catch (e) {
    console.warn('Profile check error:', e?.message || e);
  }

  // Change password while signed in (no email flow)
  console.log('Changing password (signed-in) to new password...');
  const { error: upErr } = await supabase.auth.updateUser({ password: newPassword });
  if (upErr) {
    console.error('Password update failed:', upErr.message || upErr);
    process.exit(5);
  }
  console.log('Password updated successfully');

  // Sign out
  const { error: signOutErr } = await supabase.auth.signOut();
  if (signOutErr) {
    console.warn('Sign out warning:', signOutErr.message || signOutErr);
  } else {
    console.log('Signed out');
  }

  // Sign in with new password
  console.log('Signing in with new password...');
  const { data: signInData2, error: signInErr2 } = await supabase.auth.signInWithPassword({ email, password: newPassword });
  if (signInErr2) {
    console.error('Sign in with new password failed:', signInErr2.message || signInErr2);
    process.exit(6);
  }
  console.log('Re-sign in successful. Session present:', !!signInData2?.session);

  // Fetch profile id to use as seller_id
  const { data: profileRow, error: profileErr } = await supabase.from('profiles').select('*').eq('user_id', signInData2.user.id).maybeSingle();
  if (profileErr) {
    console.warn('Profile fetch error:', profileErr.message || profileErr);
  }
  const sellerProfileId = profileRow?.id || null;
  if (!sellerProfileId) console.warn('No profile.id found; product.seller_id will use user_id instead');

  // Fetch a category id to use for the product (use first available)
  let categoryId = null;
  try {
    const { data: cats, error: catErr } = await supabase.from('categories').select('id').limit(1);
    if (catErr) console.warn('Could not fetch categories for e2e:', catErr.message || catErr);
    categoryId = cats && cats.length > 0 ? cats[0].id : null;
    if (!categoryId) console.warn('No category.id found; inserting product without category_id');
  } catch (e) {
    console.warn('Category fetch error:', e);
  }

  // Insert a sample product
  const product = {
    title: `E2E Product ${stamp}`,
    description: 'Sample product created by e2e-flow script',
    price: 9.99,
    seller_id: sellerProfileId || signInData2.user.id,
    category_id: categoryId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  };

  console.log('Inserting product:', product.title);
  const { data: prodData, error: prodErr } = await supabase.from('products').insert([product]).select().single();
  if (prodErr) {
    console.error('Product insert failed:', prodErr.message || prodErr);
    process.exit(7);
  }
  console.log('Product created:', prodData.id || prodData);

  console.log('E2E flow completed successfully');
}

run().catch((err) => {
  console.error('Unhandled error in e2e-flow:', err?.message || err);
  process.exit(9);
});
