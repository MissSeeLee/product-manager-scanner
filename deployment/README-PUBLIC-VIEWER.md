# AssetOps Public Viewer + Manager Edge Protection

Status: v4.2 candidate, not yet a completed release.

## Security boundary

Public Viewer:
- no login
- GET/HEAD only
- masked serial
- no internal location
- no project
- no responsible person
- no performed-by
- no notes
- no operation/client request ids
- no write controls

Manager:
- existing AssetOps Operations Console
- protected by Caddy Basic Auth
- HTTPS required
- backend port must not be directly public

## Added files

- `viewer/` — dependency-free read-only UI
- `backend/src/routes/public.js` — public GET API
- `backend/src/publicDb.js` — separate public DB connection boundary
- `database/migrations/005_public_viewer_read_model.sql`
- `deployment/Caddyfile.example`
- `deployment/SETUP-PUBLIC-VIEWER-DB.ps1`

## Migration 005

Back up PostgreSQL first, then:

```powershell
docker compose cp `
  ".\database\migrations\005_public_viewer_read_model.sql" `
  postgres:/tmp/005_public_viewer_read_model.sql

docker compose exec postgres `
  psql -v ON_ERROR_STOP=1 -U app -d product_manager `
  -f /tmp/005_public_viewer_read_model.sql
```

Expected final output: `COMMIT`.

Verify:

```powershell
docker compose exec postgres `
  psql -P pager=off -U app -d product_manager `
  -c "SELECT * FROM viewer.assets LIMIT 5;"

docker compose exec postgres `
  psql -P pager=off -U app -d product_manager `
  -c "SELECT * FROM viewer.asset_history ORDER BY movement_date DESC LIMIT 10;"
```

## Dedicated read-only login

After migration 005:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& ".\deployment\SETUP-PUBLIC-VIEWER-DB.ps1"
```

This creates/updates `assetops_viewer`, grants only the `assetops_viewer_reader`
role, and writes `PUBLIC_POSTGRES_*` values to `.env`.

Restart the backend afterwards.

## API checks

```powershell
Invoke-RestMethod http://localhost:3001/api/public/summary
Invoke-RestMethod "http://localhost:3001/api/public/assets?page=1&limit=5"
```

A write attempt must fail:

```powershell
Invoke-WebRequest `
  -Method Post `
  http://localhost:3001/api/public/assets
```

Expected HTTP status: 405.

## Caddy

Generate manager password hash:

```powershell
caddy hash-password
```

Never put a plaintext password in the Caddyfile.

Replace:
- `assets.example.com`
- `ops.example.com`
- `PASTE_CADDY_HASH_HERE`
- `/srv/assetops/viewer`

Public host must never proxy the general manager `/api/*`.

## Production fail-closed behavior

In production, Public Viewer APIs return 503 unless a dedicated public DB
credential is configured via `PUBLIC_DATABASE_URL` or `PUBLIC_POSTGRES_*`.

This prevents accidental production use of the writable manager DB credential.

## Release gate

Do not call this v4.2 stable until the existing v4.1 critical regression has
passed: Bulk ISSUE, partial RETURN, old ISSUE protection, Bulk MOVE, due links,
idempotency/concurrency, and HTTPS scanner behavior.
