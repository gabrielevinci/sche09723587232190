# Load environment variables from .env.local
Write-Host "Loading environment variables from .env.local..." -ForegroundColor Cyan

Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([^#].+?)=(.+)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    Write-Host "  $name = $($value.Substring(0, [Math]::Min(30, $value.Length)))..." -ForegroundColor Gray
  }
}

Write-Host "`n✅ Environment variables loaded!`n" -ForegroundColor Green

# Run the TypeScript script
$scriptPath = $args[0]
if (-not $scriptPath) {
  Write-Host "Usage: .\scripts\run-with-env.ps1 <script-path>" -ForegroundColor Red
  exit 1
}

Write-Host "Running: $scriptPath`n" -ForegroundColor Yellow
npx tsx $scriptPath
