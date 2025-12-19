-- Optimizing Search with Trigram Index
-- This allows speedy "LIKE" queries (ilike '%...%')

-- 1. Enable the extension for trigram matching
create extension if not exists pg_trgm;

-- 2. Create GIN index on items.title for fast fuzzy search
-- This changes complexity from O(table_scan) to O(log n)
create index if not exists items_title_trgm_idx on items using gin (title gin_trgm_ops);

-- 3. (Optional) Index for created_at since we sort by it
create index if not exists items_created_at_idx on items (created_at desc);
