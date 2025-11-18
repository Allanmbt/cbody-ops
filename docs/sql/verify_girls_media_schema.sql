-- Verify girls_media table has provider column
-- Run this to check if the schema is up to date

-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'girls_media'
ORDER BY ordinal_position;

-- Check if provider column exists
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'girls_media'
    AND column_name = 'provider'
) as provider_column_exists;

-- Check constraints
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.girls_media'::regclass
AND conname LIKE '%provider%';

-- If provider column doesn't exist, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'girls_media'
        AND column_name = 'provider'
    ) THEN
        -- Add provider column
        ALTER TABLE public.girls_media 
        ADD COLUMN provider TEXT NOT NULL DEFAULT 'supabase';
        
        -- Add check constraint
        ALTER TABLE public.girls_media
        ADD CONSTRAINT check_girls_media_provider 
        CHECK (provider IN ('supabase', 'cloudflare'));
        
        -- Add index
        CREATE INDEX IF NOT EXISTS idx_girls_media_provider 
        ON public.girls_media(provider);
        
        RAISE NOTICE 'Provider column added successfully';
    ELSE
        RAISE NOTICE 'Provider column already exists';
    END IF;
END $$;

