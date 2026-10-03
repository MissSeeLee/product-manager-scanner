# QA Evidence

## Local deep runtime QA

A prior deep runtime QA pass completed with:

```text
PASS 25
WARN 0
FAIL 0
```

Coverage included source/syntax/lint/build checks, database probes, runtime health/auth/API probes, and core application behavior.

## Production smoke test

Verified against the Vercel production URL:

```text
PASS P01     /api/health -> 200
PASS P02     anonymous /api/auth/me -> 401
PASS P03     SPA root -> 200
PASS P04     SPA deep link /products -> 200
PASS P05     public viewer API -> 200
```

## Authenticated production smoke test

```text
PASS A01     admin login -> 200
PASS A02     account -> 200
PASS A03     products -> 200
PASS A04     inventory -> 200
PASS A05     operations -> 200
```

Final result:

```text
RESULT: PASS
```

## Security behaviors previously verified

- anonymous Manager API requests are rejected,
- Public Viewer API remains readable without Manager authentication,
- public write attempts are rejected,
- session cookie is HttpOnly,
- Manager RBAC prevents read-only roles from protected writes,
- public database role can read the public read model and does not have Product UPDATE privilege.

## Frontend build note

The production Vite build is successful.

A non-blocking warning remains because the primary JavaScript chunk is slightly above 500 kB after minification. A future optimization is route-level/dynamic code splitting.
