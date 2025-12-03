#!/usr/bin/env pwsh
# Script per applicare la migrazione dei nuovi stati al database Neon

Write-Host ""
Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host "🔧 APPLICAZIONE MIGRAZIONE DATABASE" -ForegroundColor Cyan
Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📄 Migrazione: add_media_uploaded_scheduled_status.sql" -ForegroundColor Yellow
Write-Host ""

$sql = @"
-- AlterEnum: Aggiungi nuovi stati MEDIA_UPLOADED e SCHEDULED
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'MEDIA_UPLOADED';
ALTER TYPE "PostStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
"@

Write-Host "SQL da eseguire:" -ForegroundColor Cyan
Write-Host $sql -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  IMPORTANTE: Questa migrazione deve essere eseguita manualmente su Neon Database" -ForegroundColor Yellow
Write-Host ""
Write-Host "Passi da seguire:" -ForegroundColor Cyan
Write-Host "1. Vai su: https://console.neon.tech" -ForegroundColor White
Write-Host "2. Seleziona il tuo database" -ForegroundColor White
Write-Host "3. Vai su 'SQL Editor'" -ForegroundColor White
Write-Host "4. Copia e incolla il SQL sopra" -ForegroundColor White
Write-Host "5. Esegui la query" -ForegroundColor White
Write-Host ""

Write-Host "Oppure usa questo comando (richiede psql installato):" -ForegroundColor Cyan
Write-Host ""
Write-Host 'psql "$env:DATABASE_URL" -c "ALTER TYPE \"PostStatus\" ADD VALUE IF NOT EXISTS ''MEDIA_UPLOADED''; ALTER TYPE \"PostStatus\" ADD VALUE IF NOT EXISTS ''SCHEDULED'';"' -ForegroundColor Green
Write-Host ""

Write-Host "🔧 =====================================" -ForegroundColor Cyan
Write-Host ""
