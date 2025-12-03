-- Migration: Add OnlySocial Integration Fields
-- Description: Aggiunge i campi per memorizzare i dati restituiti dall'API OnlySocial
--              dopo upload video e schedulazione post
-- Date: 2025-12-03

-- Aggiungi campo per UUID del post OnlySocial
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

-- Aggiungi campo per array di ID media OnlySocial
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

-- Aggiungi campo per URL media su storage OnlySocial
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;

-- Aggiungi commenti per documentazione
COMMENT ON COLUMN "scheduled_posts"."onlySocialPostUuid" IS 'UUID del post creato su OnlySocial API (Step 2)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaIds" IS 'Array di ID media caricati su OnlySocial storage (Step 1)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaUrl" IS 'URL del primo video caricato su OnlySocial storage (Step 1)';
