# Portfolio Screenshot Checklist

Do **not** publish screenshots containing real company serial numbers, employee names, email addresses, credentials, database URLs, session cookies, or other production-sensitive data.

Use a dedicated demo/test account and demo assets.

## Recommended capture settings

- Browser viewport: 1440 × 900 or similar
- Browser zoom: 100%
- Hide DevTools
- Hide bookmarks/personal browser profile information where possible
- Use production UI styling, but demo/test data
- Prefer PNG

## Capture these five images

### 01 — Dashboard

Filename:

```text
docs/screenshots/01-dashboard.png
```

Show:

- main navigation,
- summary cards/metrics,
- clean authenticated production UI.

### 02 — Inventory

Filename:

```text
docs/screenshots/02-inventory.png
```

Show:

- search/filter controls,
- multiple demo assets,
- status badges,
- no real serial numbers.

### 03 — Asset detail

Filename:

```text
docs/screenshots/03-asset-detail.png
```

Show:

- one demo asset,
- current state,
- location/product information,
- contextual actions.

### 04 — Operation workspace

Filename:

```text
docs/screenshots/04-operations.png
```

Show one controlled operation flow such as Issue, Return, Move, or Claim.

Avoid publishing a destructive confirmation with real data.

### 05 — CSV intake

Filename:

```text
docs/screenshots/05-csv-intake.png
```

Show:

- strict CSV import workflow,
- template/validation/preview state,
- demo rows only.

## After capture

Uncomment the screenshot block inside the root `README.md`.

A good public README should show 3–5 screenshots, not every screen in the application.
