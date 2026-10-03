# Portfolio Case Study

## AssetOps — IT Asset Operations Manager

### Problem

IT inventory is easy to represent as a spreadsheet while every device is static. The harder engineering problem starts after equipment is issued, returned, moved, claimed, replaced, retired, bulk-imported, or corrected while historical records still need to remain trustworthy.

### What I built

I built AssetOps as a full-stack web application with an explicit asset lifecycle and operation model.

Instead of allowing users to manually overwrite status fields, the backend treats state changes as controlled operations such as Issue, Return, Claim, Replacement, and Retire.

### Engineering decisions worth discussing

**1. Atomic bulk operations**  
Multi-asset actions validate every asset before commit. Any invalid item causes the entire transaction to roll back, preventing partial operations.

**2. History-preserving master data**  
Products and Locations can appear deleted to the user while referenced records are retained internally when required for historical integrity.

**3. Explicit lifecycle rules**  
The backend owns allowed state transitions rather than relying on UI behavior.

**4. Read-only database separation**  
Public/read-only endpoints can use a PostgreSQL login restricted to the read model instead of the main application database credentials.

**5. Production routing**  
The application is deployed as Vercel Services with a Vite frontend and Express backend. SPA deep-link routing required a service-level fallback to `/index.html`.

**6. Production migration**  
The local PostgreSQL database was backed up and restored into Neon, with restore/runtime connections separated between direct and pooled endpoints.

### Stack

React, Vite, Node.js, Express, PostgreSQL, Neon, Vercel, Cloudflare.

### Production validation

Unauthenticated and authenticated production smoke tests pass for health, auth boundary, SPA deep links, Products, Inventory, and Operations.

### What I would improve next

- route-level frontend code splitting,
- CI-based integration/regression testing,
- monitoring and scheduled backup verification,
- sanitized demo data and automated portfolio screenshots.

## Resume bullet options

- Built and deployed a full-stack IT asset operations platform using React, Express, PostgreSQL, Vercel, and Neon, with RBAC, secure sessions, lifecycle workflows, and production smoke testing.
- Designed transaction-safe bulk asset operations with all-or-nothing validation to prevent partial inventory state changes.
- Modeled asset lifecycle transitions for issue/return/claim/replacement/retirement while preserving operation history and referenced master data.
- Implemented strict CSV intake validation and controlled master-data behavior to improve data consistency during bulk onboarding.
- Migrated PostgreSQL data to Neon and configured Vercel Services routing, secure cookies, custom DNS, and read-only database access for public endpoints.
