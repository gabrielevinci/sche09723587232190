-- Migrazione manuale per convertire schema da vecchio a nuovo formato

-- 1. Aggiungi nuove colonne con valori di default
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "accountUuid" TEXT DEFAULT '';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "accountId" INTEGER;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "videoUrls" TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "videoFilenames" TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "videoSizes" INTEGER[] DEFAULT '{}';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" TEXT[] DEFAULT '{}';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Europe/Rome';
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "preUploaded" BOOLEAN DEFAULT false;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "preUploadAt" TIMESTAMP;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER DEFAULT 3;

-- 2. Migra dati da colonne singole a array
UPDATE scheduled_posts 
SET 
  "videoUrls" = ARRAY["videoUrl"],
  "videoFilenames" = ARRAY["videoFilename"],
  "videoSizes" = ARRAY["videoSize"]
WHERE "videoUrl" IS NOT NULL;

-- 3. Migra onlySocialMediaId a array
UPDATE scheduled_posts 
SET "onlySocialMediaIds" = ARRAY["onlySocialMediaId"]
WHERE "onlySocialMediaId" IS NOT NULL;

-- 4. Migra onlySocialPostId a onlySocialPostUuid
UPDATE scheduled_posts 
SET "onlySocialPostUuid" = "onlySocialPostId"
WHERE "onlySocialPostId" IS NOT NULL;

-- 5. Converti status da vecchi valori a nuovi
UPDATE scheduled_posts SET status = 'PENDING' WHERE status = 'PENDING';
UPDATE scheduled_posts SET status = 'MEDIA_UPLOADED' WHERE status IN ('VIDEO_UPLOADED_DO', 'VIDEO_UPLOADED_OS');
UPDATE scheduled_posts SET status = 'MEDIA_UPLOADED', "preUploaded" = true WHERE status = 'SCHEDULED';
UPDATE scheduled_posts SET status = 'PUBLISHED' WHERE status = 'PUBLISHED';
UPDATE scheduled_posts SET status = 'FAILED' WHERE status = 'FAILED';
UPDATE scheduled_posts SET status = 'CANCELLED' WHERE status = 'CANCELLED';

-- 6. Imposta preUploadAt dai timestamp esistenti
UPDATE scheduled_posts 
SET "preUploadAt" = "uploadedToOSAt"
WHERE "uploadedToOSAt" IS NOT NULL;

-- 7. Imposta preUploaded basato su onlySocialMediaIds
UPDATE scheduled_posts 
SET "preUploaded" = true
WHERE array_length("onlySocialMediaIds", 1) > 0;

-- 8. Rimuovi vecchie colonne (commentato per sicurezza, decommentare dopo verifica)
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "videoUrl";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "videoFilename";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "videoSize";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "onlySocialMediaId";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "onlySocialPostId";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "uploadedToOSAt";
-- ALTER TABLE scheduled_posts DROP COLUMN IF EXISTS "scheduledAt";

-- 9. Aggiorna enum PostStatus (rimuovi vecchi valori)
-- Nota: Questa operazione deve essere fatta DOPO aver migrato tutti i dati
-- ALTER TYPE "PostStatus" RENAME TO "PostStatus_old";
-- CREATE TYPE "PostStatus" AS ENUM ('PENDING', 'MEDIA_UPLOADED', 'PUBLISHED', 'FAILED', 'CANCELLED');
-- ALTER TABLE scheduled_posts ALTER COLUMN status TYPE "PostStatus" USING status::text::"PostStatus";
-- DROP TYPE "PostStatus_old";
