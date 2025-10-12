# Supabase schema sync

The browser E2E flow now suppresses badge-related errors when the `badge_types`, `user_badges`, and `affiliate_stats` tables are missing. To enable the full gamification experience (leaderboards, badges, affiliate stats) in production, run the Supabase migrations included in this repo.

## Prerequisites
- Supabase CLI (`npm install -g supabase`)
- Access token with permissions to manage your project
- Project reference ID (found in the Supabase dashboard)

Export the token for the session:

```powershell
$env:SUPABASE_ACCESS_TOKEN = '<your-token>'
```

## One-time CLI login
```powershell
supabase login
```

## Apply the latest migrations to your linked project
```powershell
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` will replay everything under `supabase/migrations`, including `20250722010000_add_badges_gamification.sql`, so the REST API exposes:
- `badge_types`
- `user_badges`
- `affiliate_stats`
- `leaderboard_entries`
- helper functions like `update_affiliate_stats`

## Local verification (optional)
```powershell
supabase start
supabase db reset  # Resets the local dev instance and applies migrations
```

After running these commands, rerun `npm run e2e:browser`—you should no longer see schema warnings, and the gamification UI will populate with badge definitions once real data flows in.
