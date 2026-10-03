# Production Deployment Notes

## Current production

- Application: `https://assetops.artip.site`
- Hosting: Vercel Services
- Database: Neon PostgreSQL
- DNS: Cloudflare
- Source branch: `main`
- Verified SPA-routing baseline: `3159193`

## Vercel Services layout

The repository root `vercel.json` defines:

- `frontend/` as the Vite frontend service,
- `backend/` as the Express backend service,
- `/api` and `/api/*` -> backend,
- remaining routes -> frontend,
- SPA fallback inside the frontend service -> `/index.html`.

This service-level SPA fallback is required so routes such as `/products` return the application shell instead of a Vercel 404.

## Required runtime environment variables

```text
DATABASE_URL
PUBLIC_DATABASE_URL
NODE_ENV=production
ASSETOPS_TRUST_PROXY=1
ASSETOPS_SECURE_COOKIES=1
```

### DATABASE_URL

Use the Neon **pooled** connection string for normal Vercel runtime traffic.

Do not commit the URL or password.

### PUBLIC_DATABASE_URL

Use a separate Neon PostgreSQL login intended for read-only public endpoints.

The deployed role is expected to have:

- `LOGIN`,
- database `CONNECT`,
- `USAGE` on the read-model schema,
- `SELECT` on read-model views/tables,
- no Product UPDATE privilege.

## Database restore/migration practice

For a full dump restore:

- use the Neon **direct/unpooled** URL,
- use a PostgreSQL client compatible with the dump archive version,
- restore without transferring local ownership/privileges,
- recreate production-specific roles/grants after restore,
- verify critical AssetOps tables after restore.

For application runtime, switch back to Neon pooled URLs.

## Secure-cookie / proxy settings

Production runs behind Vercel HTTPS/proxy infrastructure.

```text
ASSETOPS_TRUST_PROXY=1
ASSETOPS_SECURE_COOKIES=1
```

These settings allow the backend to correctly treat the production request as HTTPS and issue secure session cookies.

## Custom domain

Cloudflare DNS should contain a Vercel-provided CNAME record for:

```text
assetops.artip.site
```

Keep Cloudflare proxy disabled (`DNS only`) when Vercel explicitly requires the CNAME to resolve directly for verification.

Do not hardcode the CNAME target in documentation because Vercel can provide a project/domain-specific value.

## Deployment sequence

1. Push tested code to `main`.
2. Wait for the Vercel Production deployment for that exact commit to show `Ready`.
3. Run unauthenticated production smoke checks.
4. Run authenticated Admin smoke checks.
5. Verify the custom domain.
6. Re-run smoke checks against the custom domain after DNS/HTTPS are valid.

Do not treat `git push` as equivalent to a ready production deployment; always verify the commit in Vercel first.
