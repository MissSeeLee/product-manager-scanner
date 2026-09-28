param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$envPath = Join-Path $ProjectRoot ".env"

if (-not (Test-Path $envPath)) {
    throw ".env not found: $envPath"
}

$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$password = [Convert]::ToBase64String($bytes).Replace("+", "_").Replace("/", "-").TrimEnd("=")

$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'assetops_viewer'
  ) THEN
    CREATE ROLE assetops_viewer LOGIN;
  END IF;
END
`$`$;

ALTER ROLE assetops_viewer WITH LOGIN PASSWORD '$password';
GRANT assetops_viewer_reader TO assetops_viewer;
"@

$sqlPath = Join-Path $env:TEMP "assetops-viewer-user.sql"
[System.IO.File]::WriteAllText(
    $sqlPath,
    $sql,
    (New-Object System.Text.UTF8Encoding($false))
)

try {
    Push-Location $ProjectRoot
    try {
        docker compose cp $sqlPath postgres:/tmp/assetops-viewer-user.sql
        if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed." }

        docker compose exec postgres `
            psql -v ON_ERROR_STOP=1 -U app -d product_manager `
            -f /tmp/assetops-viewer-user.sql

        if ($LASTEXITCODE -ne 0) {
            throw "Creating assetops_viewer database login failed."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Remove-Item $sqlPath -Force -ErrorAction SilentlyContinue
}

$envText = [System.IO.File]::ReadAllText(
    $envPath,
    [System.Text.Encoding]::UTF8
)

$keys = @(
    "PUBLIC_POSTGRES_HOST",
    "PUBLIC_POSTGRES_PORT",
    "PUBLIC_POSTGRES_DB",
    "PUBLIC_POSTGRES_USER",
    "PUBLIC_POSTGRES_PASSWORD"
)

foreach ($key in $keys) {
    $envText = [regex]::Replace(
        $envText,
        "(?m)^" + [regex]::Escape($key) + "=.*(?:\r?\n)?",
        ""
    )
}

$block = @"

# AssetOps Public Viewer - read-only database login
PUBLIC_POSTGRES_HOST=127.0.0.1
PUBLIC_POSTGRES_PORT=5433
PUBLIC_POSTGRES_DB=product_manager
PUBLIC_POSTGRES_USER=assetops_viewer
PUBLIC_POSTGRES_PASSWORD=$password
"@

$envText = $envText.TrimEnd() + $block + "`r`n"

[System.IO.File]::WriteAllText(
    $envPath,
    $envText,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "Public Viewer DB login configured." -ForegroundColor Green
Write-Host "Credentials were written to .env. Do not commit .env." -ForegroundColor Yellow
Write-Host "Restart backend after this step."
