# Supabase advisory hardening — 2026-10-20

Project: Beezio.co (`jzciypbdqkuwrepbfipx`).

## Applied in production

- `20261020111832_restrict_direct_trigger_function_access`: revoke direct client execution of five trigger functions. Trigger bindings remain intact.
- `20261020112038_harden_supabase_advisor_permissions`: remove unnecessary definer privileges from ownership and promoter-count helpers; move the two necessary privileged implementations to a non-API schema with explicit execution grants and invoker compatibility wrappers. Restrict directory ownership to a NOLOGIN, NOBYPASSRLS role with source-column SELECT only, no schema CREATE, and a role-specific read policy. Preserve private-field masks and public-view FK lineage.
- `20261020112327_remove_confirmed_duplicate_indexes`: remove six standalone duplicate indexes only after catalog equality, constraint, dependency, validity and replica-identity guards pass. Keep the remaining equivalent indexes and uniqueness constraints.

No user records, order amounts, payout thresholds or money movements were changed.

## Verification

- Atomic before/after snapshot comparison passed for an existing owner, anonymous access and an unrelated identity.
- Follow-up role tests passed for all eight profile owners plus anonymous and unrelated access (10 identities). All eight directory entries remain readable. Owners retain their private fields; nonowners cannot read them; the existing database-granted administrator retains authorized access.
- Email-confirmation helper results match Auth's server-side records. Ownership checks pass, nonexistent-order access is denied, public promoter counts and the product-to-directory computed relationship execute for each tested role.
- No public-schema SECURITY DEFINER function is executable by anon or authenticated.
- A fresh advisor scan confirms zero function-execution warnings and zero duplicate-index warnings.
- Browser/HTTP storefront and checkout checks were not rerun in the continuation because the execution/browser environment was unavailable. Database role and relationship checks passed. No test purchase was made.

## Remaining advisories

- Security: one `profile_directory` definer-view notice. Its owner is now restricted and does not bypass RLS. The masking/public-directory boundary is intentional; an invoker-only redesign requires separating public and private profile data rather than flipping a setting and losing public storefront rows.
- Leaked-password protection remains disabled; the observed Supabase Free-plan UI requires Pro. No upgrade was purchased.
- 17 INFO notices for RLS-enabled tables with no client policies remain deny-by-default.
- Performance: 76 auth initplan warnings; 107 overlapping-policy findings; 63 unindexed-FK notices; 139 unused-index notices. Counts are advisor findings, not unique vulnerabilities.

## Blocked proposal — not applied

`scripts/proposed-rls-auth-initplans.sql` contains the exact 76-policy proposal. It preserves each policy's command, role list and authorization predicates, changing only bare request-scoped auth calls to SELECT subqueries. Precondition guards detect policy edits since review; the script ends in ROLLBACK.

Automatic approval review rejected production execution because changing 76 production authorization policies was too broad for the general “Fix” authorization and could disrupt access. No workaround or partial execution was attempted. Specific approval is required before proceeding. Overlapping policies and unused indexes were not broadly removed.
