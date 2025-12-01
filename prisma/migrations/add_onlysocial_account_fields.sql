-- Migration: Add OnlySocial account fields to scheduled_posts and social_accounts
-- Date: 2025-12-01
-- Description: Adds accountUuid and accountId fields to store OnlySocial API account information

-- Add accountUuid to social_accounts table
ALTER TABLE social_accounts 
ADD COLUMN IF NOT EXISTS "accountUuid" TEXT;

-- Add accountUuid column to scheduled_posts (UUID from OnlySocial API)
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS "accountUuid" TEXT;

-- Add accountId column to scheduled_posts (numeric ID from OnlySocial API)
ALTER TABLE scheduled_posts 
ADD COLUMN IF NOT EXISTS "accountId" INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN social_accounts."accountUuid" IS 'UUID dell''account su OnlySocial API';
COMMENT ON COLUMN scheduled_posts."accountUuid" IS 'UUID dell''account su OnlySocial API';
COMMENT ON COLUMN scheduled_posts."accountId" IS 'ID numerico dell''account su OnlySocial API';
