# Supabase advisory hardening — 2026-10-20

Project: Beezio.co (`jzciypbdqkuwrepbfipx`).

## Applied in production

- `20261020111832_restrict_direct_trigger_function_access`: revoke direct client execution of five trigger functions. Trigger bindings remain intact.
- `20261020112038_harden_supabase_advisor_permissions`: remove unnecessary definer privileges from ownership and promoter-count helpers; move two necessary privileged implementations to a non-API schema with explicit execution grants and invoker compatibility wrappers. Restrict directory ownership to a NOLOGIN, NOBYPASSRLS role with source-column SELECT only, no schema CREATE, and a role-specific read policy. Preserve private-field masks and public-view FK lineage.
- `20261020112327_remove_confirmed_duplicate_indexes`: remove six standalone duplicate indexes after catalog equality, constraint, dependency, validity and replica-identity guards pass. Keep equivalent indexes and uniqueness constraints.
- `20261020153737_optimize_rls_auth_initplans`: cache request-scoped auth calls with SELECT subqueries in the 76 specifically approved policies. Preserve all authorization predicates, roles, commands and permissiveness.

No user records, order amounts, payout thresholds or money movements were changed.

## Approval and transaction safeguards

Automatic approval review initially blocked the broad 76-policy production change. Jason specifically approved that scope on October 20, 2026, after reviewing the proposal in PR 62. The migration was then applied atomically with:
- exact precondition guards for all 76 existing policy expressions;
- before/after hashes of visible rows (or existing denial/error states) across 49 tables/views for every profile owner plus anonymous and unrelated identities;
- exact before/after equality of policy commands, roles and permissiveness;
- automatic rollback on any access mismatch, short lock timeouts, and no production data writes.

The guarded rollback-only proposal remains as a historical review copy. The applied migration is the source of truth.

## Verification

- All before/after transaction checks passed. No policy command, role list or permissiveness changed.
- Follow-up privacy tests passed for all nine current profile owners plus anonymous and unrelated access (11 identities). All nine directory entries remain readable. Owners retain private fields; nonowners cannot read them; the existing database-granted administrator retains authorized access.
- Email-confirmation helper results match server-side Auth records. Ownership checks pass, nonexistent-order access is denied, promoter counts and the product-to-directory computed relationship execute for each tested role.
- No public-schema SECURITY DEFINER function is executable by anon or authenticated.
- Fresh advisors show zero function-execution warnings, zero duplicate-index warnings and zero auth initplan warnings (previously 18, 6 and 76 respectively).
- Live anonymous REST checks: directory 200 with nine rows and no exposed email/phone/payout/recovery fields; products with seller-directory embedding 200; review/rating embeddings 200; promoter-count RPC 200; private profiles 200 with zero rows; privileged order helper denied.
- No live purchase or payout was submitted. Full signed-in browser checkout was not rerun.

## Remaining advisories

- Security: one `profile_directory` definer-view notice. Its owner is restricted and does not bypass RLS. The masked/public-directory boundary is intentional; an invoker-only redesign requires separating public and private profile data rather than flipping a setting and losing public storefront rows.
- Leaked-password protection remains disabled; the observed Supabase Free-plan UI requires Pro. No upgrade was purchased.
- 17 INFO notices for RLS-enabled tables with no client policies remain deny-by-default.
- Performance: 107 overlapping-policy findings, 63 unindexed-FK notices and 133 unused-index notices. These are advisor findings, not unique vulnerabilities. Overlapping policies and unused indexes were not broadly removed.
