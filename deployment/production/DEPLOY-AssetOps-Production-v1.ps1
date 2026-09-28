param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner",
    [string]$ManagerDomain = "",
    [string]$ViewerDomain = "",
    [string]$AcmeEmail = "",
    [string]$PostgresVolumeName = "product-manager-scanner_postgres_data",
    [switch]$SkipCredentialRotation
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$composeProd = Join-Path $ProjectRoot "deployment\production\compose.production.yaml"
$prodEnv = Join-Path $ProjectRoot ".env.production"
$devEnv = Join-Path $ProjectRoot ".env"

function New-Secret([int]$Bytes = 36) {
    $b = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_').TrimEnd('=')
}

function Read-EnvMap([string]$Path) {
    $m = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $i = $line.IndexOf('=')
        $k = $line.Substring(0,$i).Trim()
        $v = $line.Substring($i+1).Trim()
        if ($k) { $m[$k] = $v }
    }
    return $m
}

function Set-EnvValues([string]$Path, [hashtable]$Values) {
    $lines = @()
    if (Test-Path $Path) { $lines = @(Get-Content $Path) }
    $done = @{}
    $out = New-Object System.Collections.Generic.List[string]
    foreach ($line in $lines) {
        if ($line -match '^\s*([^#=\s]+)=(.*)$') {
            $key = $Matches[1]
            if ($Values.ContainsKey($key)) {
                $out.Add("$key=$($Values[$key])")
                $done[$key] = $true
                continue
            }
        }
        $out.Add($line)
    }
    foreach ($key in $Values.Keys) {
        if (-not $done.ContainsKey($key)) { $out.Add("$key=$($Values[$key])") }
    }
    [System.IO.File]::WriteAllLines($Path, $out, (New-Object System.Text.UTF8Encoding($false)))
}

function Assert-Domain([string]$Value, [string]$Name) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -match '://' -or $Value -match '[/:]' -or $Value -ieq 'localhost') {
        throw "$Name must be a hostname only, e.g. ops.example.com"
    }
}

if (-not (Test-Path $composeProd)) { throw "Production deployment files are not installed: $composeProd" }
if (-not (Test-Path $devEnv)) { throw "Current .env not found: $devEnv" }

if ([string]::IsNullOrWhiteSpace($ManagerDomain)) { $ManagerDomain = Read-Host "Manager domain (example: ops.example.com)" }
if ([string]::IsNullOrWhiteSpace($ViewerDomain)) { $ViewerDomain = Read-Host "Public Viewer domain (example: assets.example.com)" }
if ([string]::IsNullOrWhiteSpace($AcmeEmail)) { $AcmeEmail = Read-Host "Email for HTTPS certificate notices" }
Assert-Domain $ManagerDomain "ManagerDomain"
Assert-Domain $ViewerDomain "ViewerDomain"
if ($ManagerDomain -ieq $ViewerDomain) { throw "Manager and Viewer must use different hostnames." }
if ($AcmeEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { throw "AcmeEmail does not look valid." }

$latest = Get-ChildItem (Join-Path $ProjectRoot "qa-reports") -Filter "full-system-v1.1-*.csv" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { throw "Full-System QA v1.1 report not found." }
$rows = @(Import-Csv $latest.FullName)
$pass = @($rows | Where-Object {$_.Status -eq 'PASS'}).Count
$fail = @($rows | Where-Object {$_.Status -eq 'FAIL'}).Count
$warn = @($rows | Where-Object {$_.Status -eq 'WARN'}).Count
if ($pass -lt 160 -or $fail -ne 0 -or $warn -ne 0) { throw "Deployment blocked by QA gate: PASS $pass / FAIL $fail / WARN $warn" }
Write-Host "PASS QA gate: PASS $pass / FAIL 0 / WARN 0" -ForegroundColor Green

$volumeExists = docker volume ls --format '{{.Name}}' | Where-Object { $_ -eq $PostgresVolumeName }
if (-not $volumeExists) { throw "PostgreSQL volume not found: $PostgresVolumeName" }

$dev = Read-EnvMap $devEnv
$db = if ($dev.ContainsKey('POSTGRES_DB')) { $dev['POSTGRES_DB'] } else { 'product_manager' }
$dbUser = if ($dev.ContainsKey('POSTGRES_USER')) { $dev['POSTGRES_USER'] } else { 'app' }
$publicUser = if ($dev.ContainsKey('PUBLIC_POSTGRES_USER')) { $dev['PUBLIC_POSTGRES_USER'] } else { 'assetops_viewer' }
$publicDb = if ($dev.ContainsKey('PUBLIC_POSTGRES_DB')) { $dev['PUBLIC_POSTGRES_DB'] } else { $db }

$backupDir = Join-Path $ProjectRoot "db-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$preDump = Join-Path $backupDir "pre-production-$stamp.dump"

Push-Location $ProjectRoot
try {
    # Backup from the existing dev postgres before changing credentials or containers.
    docker compose exec -T postgres pg_dump -Fc -U $dbUser -d $db -f "/tmp/pre-production.dump"
    if ($LASTEXITCODE -ne 0) { throw "Pre-production pg_dump failed." }
    docker compose cp "postgres:/tmp/pre-production.dump" $preDump
    if ($LASTEXITCODE -ne 0) { throw "Could not copy pre-production backup." }
    docker compose exec -T postgres rm -f "/tmp/pre-production.dump" | Out-Null

    if (-not $SkipCredentialRotation) {
        $newAppPassword = New-Secret
        $newViewerPassword = New-Secret
        $sql = @"
ALTER ROLE $dbUser WITH PASSWORD '$newAppPassword';
ALTER ROLE $publicUser WITH PASSWORD '$newViewerPassword';
"@
        $sqlFile = Join-Path $env:TEMP "assetops-rotate-$stamp.sql"
        [System.IO.File]::WriteAllText($sqlFile, $sql, (New-Object System.Text.UTF8Encoding($false)))
        try {
            docker compose cp $sqlFile "postgres:/tmp/assetops-rotate.sql"
            if ($LASTEXITCODE -ne 0) { throw "Could not copy credential rotation SQL." }
            docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U $dbUser -d $db -f "/tmp/assetops-rotate.sql"
            if ($LASTEXITCODE -ne 0) { throw "Database credential rotation failed." }
        }
        finally { Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue }

        Copy-Item $devEnv ($devEnv + ".pre-production-$stamp.bak") -Force
        Set-EnvValues $devEnv @{
            POSTGRES_PASSWORD=$newAppPassword
            PUBLIC_POSTGRES_PASSWORD=$newViewerPassword
        }
    }
    else {
        if (-not $dev.ContainsKey('POSTGRES_PASSWORD') -or -not $dev.ContainsKey('PUBLIC_POSTGRES_PASSWORD')) {
            throw "Current .env lacks database passwords; cannot use -SkipCredentialRotation."
        }
        $newAppPassword = $dev['POSTGRES_PASSWORD']
        $newViewerPassword = $dev['PUBLIC_POSTGRES_PASSWORD']
    }

    Set-EnvValues $prodEnv @{
        MANAGER_DOMAIN=$ManagerDomain
        VIEWER_DOMAIN=$ViewerDomain
        ACME_EMAIL=$AcmeEmail
        POSTGRES_VOLUME_NAME=$PostgresVolumeName
        POSTGRES_DB=$db
        POSTGRES_USER=$dbUser
        POSTGRES_PASSWORD=$newAppPassword
        PUBLIC_POSTGRES_DB=$publicDb
        PUBLIC_POSTGRES_USER=$publicUser
        PUBLIC_POSTGRES_PASSWORD=$newViewerPassword
        NODE_ENV='production'
        ASSETOPS_SECURE_COOKIES='1'
        ASSETOPS_TRUST_PROXY='1'
        BACKEND_PORT='3001'
    }

    Write-Host "Stopping development postgres/adminer WITHOUT deleting the volume..." -ForegroundColor Yellow
    docker compose stop adminer postgres
    if ($LASTEXITCODE -ne 0) { throw "Could not stop development database stack." }

    Write-Host "Building and starting production stack..." -ForegroundColor Cyan
    docker compose -f $composeProd --env-file $prodEnv up -d --build
    if ($LASTEXITCODE -ne 0) { throw "Production docker compose up failed." }

    docker compose -f $composeProd --env-file $prodEnv ps
    if ($LASTEXITCODE -ne 0) { throw "Could not read production compose status." }
}
finally { Pop-Location }

Write-Host "" 
Write-Host "PASS: AssetOps production stack started." -ForegroundColor Green
Write-Host "Backup: $preDump"
Write-Host "Manager: https://$ManagerDomain"
Write-Host "Viewer : https://$ViewerDomain"
Write-Host "" 
Write-Host "DNS for both hostnames must point to this server and inbound TCP 80/443 must be reachable for Caddy HTTPS." -ForegroundColor Yellow
Write-Host "Run SMOKE-AssetOps-Production-v1.ps1 after HTTPS is issued." -ForegroundColor Yellow
