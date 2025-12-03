#!/usr/bin/env pwsh
# Script per applicare tutte le migrazioni al database Neon

Write-Host ""
Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host "🔧 APPLICAZIONE MIGRAZIONI DATABASE" -ForegroundColor Cyan
Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host ""

# Migrazione 1: Nuovi stati enum
Write-Host "📄 Migrazione 1: add_media_uploaded_scheduled_status.sql" -ForegroundColor Yellow
Write-Host ""

$sql1 = @"
-- AlterEnum: Aggiungi nuovi stati MEDIA_UPLOADED e SCHEDULED
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
"@

Write-Host "SQL da eseguire:" -ForegroundColor Cyan
Write-Host $sql1 -ForegroundColor Gray
Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Migrazione 2: Campi integrazione OnlySocial
Write-Host "📄 Migrazione 2: add_onlysocial_integration_fields.sql" -ForegroundColor Yellow
Write-Host ""

$sql2 = @"
-- Add OnlySocial Integration Fields
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;

COMMENT ON COLUMN "scheduled_posts"."onlySocialPostUuid" IS 'UUID del post creato su OnlySocial API (Step 2)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaIds" IS 'Array di ID media caricati su OnlySocial storage (Step 1)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaUrl" IS 'URL del primo video caricato su OnlySocial storage (Step 1)';
"@

Write-Host "SQL da eseguire:" -ForegroundColor Cyan
Write-Host $sql2 -ForegroundColor Gray
Write-Host ""

# Istruzioni
Write-Host "⚠️  IMPORTANTE: Queste migrazioni devono essere eseguite manualmente su Neon Database" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Passi da seguire:" -ForegroundColor Cyan
Write-Host "1. Vai su: https://console.neon.tech" -ForegroundColor White
Write-Host "2. Seleziona il tuo database" -ForegroundColor White
Write-Host "3. Vai su 'SQL Editor'" -ForegroundColor White
Write-Host "4. Copia e incolla TUTTO il SQL qui sotto" -ForegroundColor White
Write-Host "5. Esegui la query" -ForegroundColor White
Write-Host ""

# SQL completo
Write-Host "📝 SQL COMPLETO DA COPIARE:" -ForegroundColor Green
Write-Host "---------------------------------------------------" -ForegroundColor Green

$sqlComplete = @"
-- ====================================
-- MIGRAZIONI DATABASE - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
-- ====================================

-- Migrazione 1: Nuovi stati enum
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Migrazione 2: Campi integrazione OnlySocial
ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialPostUuid" TEXT;

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaIds" INTEGER[] DEFAULT '{}';

ALTER TABLE "scheduled_posts" 
ADD COLUMN IF NOT EXISTS "onlySocialMediaUrl" TEXT;

COMMENT ON COLUMN "scheduled_posts"."onlySocialPostUuid" IS 'UUID del post creato su OnlySocial API (Step 2)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaIds" IS 'Array di ID media caricati su OnlySocial storage (Step 1)';
COMMENT ON COLUMN "scheduled_posts"."onlySocialMediaUrl" IS 'URL del primo video caricato su OnlySocial storage (Step 1)';
"@

Write-Host $sqlComplete -ForegroundColor Yellow
Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor Green
Write-Host ""

Write-Host "💡 Oppure usa questo comando (richiede psql installato):" -ForegroundColor Cyan
Write-Host ""
Write-Host 'psql "$env:DATABASE_URL" << EOF' -ForegroundColor Green
Write-Host $sqlComplete -ForegroundColor Green
Write-Host 'EOF' -ForegroundColor Green
Write-Host ""

Write-Host "✅ Dopo aver applicato le migrazioni, verifica con:" -ForegroundColor Cyan
Write-Host 'psql "$env:DATABASE_URL" -c "\d scheduled_posts"' -ForegroundColor Green
Write-Host ""

Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host ""
