param(
    [Parameter(Mandatory=$true)][string]$DumpFile,
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$DumpFile = [System.IO.Path]::GetFullPath($DumpFile)
if (-not (Test-Path $DumpFile)) { throw "Dump not found: $DumpFile" }

$compose = Join-Path $ProjectRoot "deployment\production\compose.production.yaml"
$envFile = Join-Path $ProjectRoot ".env.production"
$confirm = Read-Host "Type RESTORE to replace the production database using $DumpFile"
if ($confirm -ne "RESTORE") { throw "Restore cancelled." }

& (Join-Path $ProjectRoot "deployment\production\BACKUP-AssetOps-Production-v1.ps1") -ProjectRoot $ProjectRoot -Label "pre-restore"

$containerFile = "/tmp/assetops-restore.dump"
Push-Location $ProjectRoot
try {
    docker compose -f $compose --env-file $envFile stop backend edge
    if ($LASTEXITCODE -ne 0) { throw "Could not stop backend/edge." }

    docker compose -f $compose --env-file $envFile cp $DumpFile ("postgres:" + $containerFile)
    if ($LASTEXITCODE -ne 0) { throw "Could not copy dump into postgres container." }

    docker compose -f $compose --env-file $envFile exec -T postgres pg_restore --clean --if-exists --no-owner --exit-on-error -U app -d product_manager $containerFile
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed." }

    docker compose -f $compose --env-file $envFile exec -T postgres rm -f $containerFile | Out-Null
    docker compose -f $compose --env-file $envFile up -d backend edge
    if ($LASTEXITCODE -ne 0) { throw "Could not restart backend/edge." }
}
finally { Pop-Location }

Write-Host "PASS: restore completed. Run production smoke test now." -ForegroundColor Green
