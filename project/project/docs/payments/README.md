# Payments Docs

Start here:
- `BEEZIO-LEDGER-PAYOUT-PACK.md` (all-in-one pack)
- `BEEZIO-LEDGER-PAYOUT-SCHEMA-GREENFIELD.sql` (fresh-project DDL)
- `IMPLEMENTATION-CHECKLIST.md`
- `ACCOUNTANT-HANDOFF.md`

Repo reality check:
- This codebase already includes PayPal checkout + payouts automation scaffolding via Netlify Functions.
- Prefer adding *additive* Supabase migrations over introducing a second orders/ledger schema.
