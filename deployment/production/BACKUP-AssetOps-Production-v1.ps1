param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner",
    [string]$Label = "production"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$compose = Join-Path $ProjectRoot "deployment\production\compose.production.yaml"
$envFile = Join-Path $ProjectRoot ".env.production"
$backupDir = Join-Path $ProjectRoot "db-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = Join-Path $backupDir ("{0}-{1}.dump" -f $Label, $stamp)
$containerFile = "/tmp/assetops-$stamp.dump"

Push-Location $ProjectRoot
try {
    docker compose -f $compose --env-file $envFile exec -T postgres pg_dump -Fc -U app -d product_manager -f $containerFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
    docker compose -f $compose --env-file $envFile cp ("postgres:" + $containerFile) $file
    if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed." }
    docker compose -f $compose --env-file $envFile exec -T postgres rm -f $containerFile | Out-Null
}
finally { Pop-Location }

if (-not (Test-Path $file) -or (Get-Item $file).Length -lt 1024) {
    throw "Backup file is missing or unexpectedly small: $file"
}
Write-Host "PASS: PostgreSQL backup created." -ForegroundColor Green
Write-Host $file
