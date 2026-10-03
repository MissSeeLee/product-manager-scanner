# Architecture

## Production topology

```mermaid
flowchart TB
    Browser["Admin / Operator / Viewer<br/>Browser"]

    subgraph Edge["Internet / Edge"]
        CF["Cloudflare DNS<br/>assetops.artip.site"]
        V["Vercel Services Router"]
    end

    subgraph App["Application Services"]
        FE["frontend service<br/>React + Vite"]
        BE["backend service<br/>Node.js + Express"]
    end

    subgraph Data["Data"]
        Neon["Neon PostgreSQL"]
        RO["assetops_viewer<br/>read-only login"]
    end

    Browser -->|HTTPS| CF
    CF --> V
    V -->|all non-/api routes| FE
    V -->|/api and /api/*| BE
    FE -->|relative /api requests| BE
    BE -->|DATABASE_URL / pooled| Neon
    BE -->|PUBLIC_DATABASE_URL| RO
    RO -->|SELECT only| Neon
```

## Service responsibilities

### Frontend

The Manager UI is a React/Vite single-page application.

The production router must preserve SPA deep links. `/products`, `/inventory/...`, and other client routes are routed to the frontend service and resolved through `/index.html`, after which React Router handles the route.

### Backend

Express owns:

- authentication/session endpoints,
- Manager APIs,
- lifecycle operations,
- Product/Location/Project management,
- CSV intake validation/import,
- public read-only endpoints.

Manager APIs are protected behind the authentication/authorization boundary.

### PostgreSQL

The relational model preserves both current state and operation history.

Important integrity concepts include:

- explicit asset status,
- operation/movement records,
- current issue linkage,
- source-operation linkage,
- referenced master-data preservation,
- database transactions for multi-asset mutation.

## Request routing

```text
GET /login
GET /products
GET /inventory/123
        |
        v
frontend service -> /index.html -> React Router

GET/POST /api/...
        |
        v
backend service -> Express -> PostgreSQL
```

## Read-only public data path

The repository contains a public read model and public API.

Production database access for that path is configured through a separate PostgreSQL role with only the privileges required to read the viewer schema. It is not given Product UPDATE privilege.

The current production UX uses authenticated Viewer accounts instead of deploying the optional standalone Viewer UI.
