# Supabase SQL Workflow

## Important

Clicking a `.sql` file in this environment does not run it in Supabase.

It only opens the file path like a link in the client, which is why it behaves like a web page instead of updating the database.

At this point, none of the pending SQL files should be assumed to be live in Supabase unless you manually ran them in the Supabase SQL Editor.

## Correct Workflow

1. Open Supabase dashboard
2. Go to `SQL Editor`
3. Open the local `.sql` file in your editor
4. Copy the contents
5. Paste into Supabase SQL Editor
6. Run it
7. Verify the affected table/column exists

## Current Status

There is no active lab migration file in the app right now.

The insurance, SaaS, digital-goods, and service ideas should be treated as concept work only unless a future migration is intentionally created and then manually run in Supabase.

## Recommendation

Keep a short checklist every time you apply SQL:

- file name
- date run
- environment run against
- result
- verification query

## Verification Examples

After running a migration, verify with queries like:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
order by column_name;
```

```sql
select id, name
from public.categories
order by name;
```

## Safe Working Rule

Frontend code can be built ahead of database rollout, but anything depending on new columns or tables should be treated as staged until the SQL has actually been run in Supabase.
