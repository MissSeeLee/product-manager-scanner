param(
    [string]$ProjectRoot = "C:\Users\artid\Desktop\product-manager-scanner"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$envFile = Join-Path $ProjectRoot ".env.production"
$compose = Join-Path $ProjectRoot "deployment\production\compose.production.yaml"
if (-not (Test-Path $envFile)) { throw ".env.production not found." }

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

function Invoke-Status([string]$Method, [string]$Url, $Session=$null, $Body=$null) {
    try {
        $args = @{ Uri=$Url; Method=$Method; UseBasicParsing=$true; ErrorAction='Stop' }
        if ($Session) { $args.WebSession = $Session }
        if ($null -ne $Body) {
            $args.ContentType = 'application/json'
            $args.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
        }
        $r = Invoke-WebRequest @args
        return @{ Status=[int]$r.StatusCode; Response=$r; Body=$r.Content }
    }
    catch {
        $status = 0
        $body = ""
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                    $reader.Dispose()
                }
            } catch {}
        }
        return @{ Status=$status; Response=$null; Body=$body }
    }
}

function Check([string]$Name, [bool]$Ok, [string]$Detail) {
    if ($Ok) { Write-Host "PASS  $Name  $Detail" -ForegroundColor Green }
    else { Write-Host "FAIL  $Name  $Detail" -ForegroundColor Red; $script:Failures++ }
}

$envs = Read-EnvMap $envFile
$manager = "https://" + $envs['MANAGER_DOMAIN']
$viewer = "https://" + $envs['VIEWER_DOMAIN']
$script:Failures = 0

Write-Host "AssetOps Production Smoke Test" -ForegroundColor Cyan
Write-Host "Manager: $manager"
Write-Host "Viewer : $viewer"

Push-Location $ProjectRoot
try {
    $ps = docker compose -f $compose --env-file $envFile ps --format json | Out-String
    Check "S01" ($LASTEXITCODE -eq 0) "Production compose is reachable."
    Check "S02" ($ps -notmatch '5432->' -and $ps -notmatch '3001->' -and $ps -notmatch '8080->') "DB/backend/Adminer are not published to host ports."
}
finally { Pop-Location }

$r = Invoke-Status GET ($manager + "/api/health")
Check "S03" ($r.Status -eq 200) "Manager health -> HTTP $($r.Status)"
$r = Invoke-Status GET ($manager + "/login")
Check "S04" ($r.Status -eq 200) "Manager login SPA -> HTTP $($r.Status)"
$r = Invoke-Status GET ($manager + "/api/auth/me")
Check "S05" ($r.Status -eq 401) "Anonymous manager /me -> HTTP $($r.Status)"
$r = Invoke-Status GET ($viewer + "/api/public/summary")
Check "S06" ($r.Status -eq 200) "Public summary -> HTTP $($r.Status)"
$r = Invoke-Status POST ($viewer + "/api/public/assets") $null @{}
Check "S07" ($r.Status -eq 405) "Public write rejected -> HTTP $($r.Status)"
$r = Invoke-Status GET ($viewer + "/api/products")
Check "S08" ($r.Status -eq 404) "Manager API hidden on viewer host -> HTTP $($r.Status)"

$adminUser = Read-Host "Admin username [admin]"
if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = "admin" }
$secure = Read-Host "Admin password" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $adminPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$r = Invoke-Status POST ($manager + "/api/auth/login") $session @{ username=$adminUser; password=$adminPass }
$adminPass = $null
Check "S09" ($r.Status -eq 200) "Production Admin login -> HTTP $($r.Status)"
$r = Invoke-Status GET ($manager + "/api/auth/me") $session
Check "S10" ($r.Status -eq 200) "Authenticated /me -> HTTP $($r.Status)"
$r = Invoke-Status POST ($manager + "/api/auth/logout") $session @{}
Check "S11" ($r.Status -eq 200) "Logout -> HTTP $($r.Status)"
$r = Invoke-Status GET ($manager + "/api/auth/me") $session
Check "S12" ($r.Status -eq 401) "Logged-out session rejected -> HTTP $($r.Status)"

if ($script:Failures -gt 0) {
    throw "Production smoke test failed: $script:Failures failure(s)."
}
Write-Host "PASS: AssetOps production smoke test completed with no failures." -ForegroundColor Green
