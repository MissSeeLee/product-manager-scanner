param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner",
    [string]$Tag = "assetops-v1-predeploy-pass160"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

function Assert-LastExit([string]$Message) {
    if ($LASTEXITCODE -ne 0) { throw $Message }
}

function Get-LatestQaReport {
    $dir = Join-Path $ProjectRoot "qa-reports"
    $report = Get-ChildItem -Path $dir -Filter "full-system-v1.1-*.csv" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $report) { throw "No full-system-v1.1 QA report found in $dir" }
    return $report
}

Write-Host "AssetOps pre-deployment checkpoint" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"

$report = Get-LatestQaReport
$rows = @(Import-Csv $report.FullName)
$pass = @($rows | Where-Object { $_.Status -eq "PASS" }).Count
$fail = @($rows | Where-Object { $_.Status -eq "FAIL" }).Count
$warn = @($rows | Where-Object { $_.Status -eq "WARN" }).Count

if ($fail -ne 0 -or $warn -ne 0 -or $pass -lt 160) {
    throw "QA gate failed: PASS $pass / FAIL $fail / WARN $warn. Expected at least PASS 160 / FAIL 0 / WARN 0."
}
Write-Host "PASS QA gate: PASS $pass / FAIL 0 / WARN 0" -ForegroundColor Green

Push-Location $ProjectRoot
try {
    node --check ".\backend\src\server.js"
    Assert-LastExit "Backend syntax check failed."
    node --check ".\backend\src\app.js"
    Assert-LastExit "Backend app syntax check failed."

    Push-Location ".\frontend"
    try {
        npm run lint
        Assert-LastExit "Frontend lint failed."
        npm run build
        Assert-LastExit "Frontend build failed."
    }
    finally { Pop-Location }

    $env:GIT_PAGER = "cat"
    git diff --check
    Assert-LastExit "git diff --check failed."

    git add -A
    Assert-LastExit "git add failed."

    $stagedSecrets = @(git diff --cached --name-only | Where-Object { $_ -match '(^|/)(\.env($|\.)|\.local-secrets/|db-backups/|\.patch-backups/)' })
    if ($stagedSecrets.Count -gt 0) {
        git reset
        throw "Refusing checkpoint: secret/backup paths were staged: $($stagedSecrets -join ', ')"
    }

    $hasStaged = -not [string]::IsNullOrWhiteSpace((git diff --cached --name-only | Out-String))
    if ($hasStaged) {
        git commit -m "AssetOps v1 predeploy - Full QA PASS $pass"
        Assert-LastExit "git commit failed. Configure git user.name/user.email if needed."
    }
    else {
        Write-Host "No uncommitted source changes to checkpoint." -ForegroundColor Yellow
    }

    $tagExists = git tag --list $Tag
    if ([string]::IsNullOrWhiteSpace(($tagExists | Out-String))) {
        git tag -a $Tag -m "AssetOps v1 predeploy; Full-System QA PASS $pass / FAIL 0 / WARN 0"
        Assert-LastExit "git tag failed."
        Write-Host "Created tag: $Tag" -ForegroundColor Green
    }
    else {
        Write-Host "Tag already exists: $Tag" -ForegroundColor Yellow
    }

    Write-Host "PASS: source checkpoint created." -ForegroundColor Green
    Write-Host "QA report: $($report.FullName)"
}
finally { Pop-Location }
