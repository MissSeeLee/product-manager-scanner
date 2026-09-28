param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner",
    [string]$Tag = "assetops-v1-production"
)
$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
Push-Location $ProjectRoot
try {
    $env:GIT_PAGER = "cat"
    git add -A
    if ($LASTEXITCODE -ne 0) { throw "git add failed." }
    $bad = @(git diff --cached --name-only | Where-Object { $_ -match '(^|/)(\.env($|\.)|\.local-secrets/|db-backups/|\.patch-backups/)' })
    if ($bad.Count -gt 0) { git reset; throw "Secret/backup path staged: $($bad -join ', ')" }
    $hasStaged = -not [string]::IsNullOrWhiteSpace((git diff --cached --name-only | Out-String))
    if ($hasStaged) {
        git commit -m "AssetOps v1 production deployment"
        if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
    }
    if ([string]::IsNullOrWhiteSpace((git tag --list $Tag | Out-String))) {
        git tag -a $Tag -m "AssetOps v1 production deployment"
        if ($LASTEXITCODE -ne 0) { throw "git tag failed." }
    }
    Write-Host "PASS: Production checkpoint finalized: $Tag" -ForegroundColor Green
}
finally { Pop-Location }
