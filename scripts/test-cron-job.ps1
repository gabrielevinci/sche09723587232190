#!/usr/bin/env pwsh
# Script per testare il cron job endpoint localmente

Write-Host ""
Write-Host "🧪 =====================================" -ForegroundColor Cyan
Write-Host "🧪 TEST CRON JOB ENDPOINT" -ForegroundColor Cyan
Write-Host "🧪 =====================================" -ForegroundColor Cyan
Write-Host ""

$CRON_SECRET = "9a8690b9c9b6d176192e8c4d0366406d0d365fa73e146c588f1c21fff8a74395"
$URL = "http://localhost:3000/api/cron/trigger"

Write-Host "📍 URL: $URL" -ForegroundColor Yellow
Write-Host "🔐 Secret: $($CRON_SECRET.Substring(0, 20))..." -ForegroundColor Yellow
Write-Host ""

Write-Host "📡 Invio richiesta POST..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $URL `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $CRON_SECRET"
            "Content-Type" = "application/json"
        } `
        -Body '{"source":"test","trigger":"manual"}' `
        -UseBasicParsing

    Write-Host ""
    Write-Host "✅ Risposta ricevuta!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📄 Response Body:" -ForegroundColor Cyan
    Write-Host $response.Content
    Write-Host ""
    Write-Host "✅ TEST COMPLETATO CON SUCCESSO!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ ERRORE!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Messaggio: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
    Write-Host ""
}

Write-Host "🧪 =====================================" -ForegroundColor Cyan
Write-Host ""
