-- Step 1: Check ALL table structures to see their ID types
-- Run this first to see what we're working with

SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    CASE 
        WHEN c.data_type = 'bigint' THEN '⚠️ BIGINT (needs ::text conversion)'
        WHEN c.data_type = 'uuid' THEN '✅ UUID (direct comparison OK)'
        ELSE '❓ OTHER TYPE'
    END as type_status
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND c.column_name IN ('id', 'user_id', 'buyer_id', 'seller_id', 'affiliate_id')
ORDER BY t.table_name, c.column_name;
