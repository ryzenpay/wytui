#!/bin/bash
# Fix for failed migration 20260526192937_add_fulltext_search
# This migration creates search_vector columns and indexes for full-text search

echo "=== Checking migration status ==="

# Check if columns exist in the database
echo "Checking if search_vector columns exist..."

# For Kubernetes deployment
kubectl exec -n wytui deployment/wytui-postgresql -it -- psql -U postgres -d wytui -c "
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE column_name = 'search_vector'
  AND table_schema = 'public';"

echo ""
echo "Checking if indexes exist..."
kubectl exec -n wytui deployment/wytui-postgresql -it -- psql -U postgres -d wytui -c "
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%search%';"

echo ""
echo "=== Fix Instructions ==="
echo ""
echo "If the columns and indexes exist (you see search_vector for downloads and subtitle_lines):"
echo "Run this command to mark the migration as resolved:"
echo ""
echo "kubectl exec -n wytui deployment/wytui-app -- npx prisma migrate resolve --applied 20260526192937_add_fulltext_search"
echo ""
echo "If the columns DON'T exist, the migration needs to be run manually:"
echo "kubectl exec -n wytui deployment/wytui-postgresql -it -- psql -U postgres -d wytui"
echo "Then run the SQL from: prisma/migrations/20260526192937_add_fulltext_search/migration.sql"
echo ""
