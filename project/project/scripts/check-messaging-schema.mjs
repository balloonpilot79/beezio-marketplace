import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(2);
}

const supabase = createClient(url, anon);

const tables = [
  'store_conversations',
  'store_conversation_participants',
  'store_messages',
  'support_threads',
  'support_thread_participants',
  'support_messages',
  'admin_announcements',
  'admin_announcement_reads',
  'disputes',
  'dispute_messages',
];

async function probe(table) {
  const { error } = await supabase.from(table).select('*').limit(1);
  if (!error) {
    return { table, ok: true, note: 'select ok (RLS may still restrict rows)' };
  }

  const code = error.code || '';
  const message = error.message || String(error);

  // Typical missing-table indicators from PostgREST
  const missing = code === '42P01' || /relation .* does not exist/i.test(message) || /does not exist/i.test(message);
  if (missing) {
    return { table, ok: false, note: `MISSING TABLE (${code || 'no-code'}): ${message}` };
  }

  // RLS / permissions is still a good sign the table exists.
  const rls = /permission denied|row level security|RLS/i.test(message);
  if (rls) {
    return { table, ok: true, note: `exists but restricted: ${message}` };
  }

  return { table, ok: false, note: `${code || 'error'}: ${message}` };
}

(async () => {
  console.log('Messaging schema probe (unauthenticated anon key)');
  console.log('Supabase URL:', url);
  console.log('');

  const results = [];
  for (const t of tables) {
    results.push(await probe(t));
  }

  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.table} -> ${r.note}`);
  }

  const missing = results.filter((r) => !r.ok && /MISSING TABLE/.test(r.note));
  if (missing.length) {
    console.log('\nNext step: apply Supabase migrations (DB schema) before messaging can work.');
  } else {
    console.log('\nNext step: deploy Edge Functions if invokes return 404/non-2xx.');
  }
})();
