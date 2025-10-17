-- Check All Tables for RLS Status
-- This query identifies all tables that are public but don't have RLS enabled

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = false THEN '⚠️ RLS NOT ENABLED'
        ELSE '✅ RLS ENABLED'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%'
ORDER BY rowsecurity, tablename;

-- Also check which tables have policies
SELECT DISTINCT
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policy_count,
    CASE 
        WHEN t.rowsecurity = false THEN '⚠️ NO RLS'
        WHEN COUNT(p.policyname) = 0 THEN '⚠️ RLS ENABLED BUT NO POLICIES'
        ELSE '✅ RLS + POLICIES'
    END as security_status
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
AND t.tablename NOT LIKE 'pg_%'
AND t.tablename NOT LIKE 'sql_%'
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY security_status, t.tablename;
