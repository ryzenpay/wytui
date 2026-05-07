# Helm Chart Design for wytui

## Overview

Add a Helm chart for deploying wytui to Kubernetes, following the arr-stack chart's structure and conventions. Update the GitHub Actions workflow to package and publish the chart to GHCR as an OCI artifact. Update the README with Helm installation instructions.

## Chart Structure

```
charts/wytui/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── _helpers.tpl
    ├── deployment/
    │   ├── wytui.yaml
    │   └── postgresql.yaml
    ├── service/
    │   ├── wytui.yaml
    │   ├── postgresql.yaml
    │   └── ingress.yaml
    ├── volumes/
    │   ├── downloads.yaml
    │   ├── library.yaml
    │   └── postgresql.yaml
    └── config/
        └── secret.yaml
```

## Chart.yaml

- `apiVersion: v2`
- `name: wytui`
- `description: Self-hosted web UI for yt-dlp`
- `type: application`
- `version: 0.1.0`
- `appVersion` matches the app's current version (use `latest` initially since there are no semver tags yet)

## values.yaml

```yaml
image:
  repository: ghcr.io/willuhmjs/wytui
  tag: latest
  pullPolicy: IfNotPresent

strategy:
  type: Recreate

ingress:
  enabled: true
  className: traefik
  domain: wytui.example.com
  annotations: {}
  tls:
    enabled: false
    secretName: wytui-tls

secret:
  existing: false
  name: wytui-secret
  authSecret: ""          # AUTH_SECRET - required, must be set by user
  # OIDC (optional)
  oidcName: ""
  oidcClientId: ""
  oidcClientSecret: ""
  oidcIssuer: ""

postgresql:
  enabled: true           # Set false to use external DB
  image: postgres:18-alpine
  username: wytui
  password: wytui
  database: wytui
  persistent:
    size: 5Gi
    storageClass: ""
    accessModes:
      - ReadWriteOnce

externalDatabase:
  url: ""                 # Only used when postgresql.enabled=false

downloads:
  persistent:
    size: 50Gi
    storageClass: ""
    accessModes:
      - ReadWriteOnce

library:
  persistent:
    size: 100Gi
    storageClass: ""
    accessModes:
      - ReadWriteOnce
```

## Templates

### deployment/wytui.yaml

- Single-replica Deployment with `Recreate` strategy
- `securityContext.fsGroup: 1001` (matches Dockerfile's `nodejs` user)
- **Init container**: runs `npx prisma migrate deploy` using the same app image, with `DATABASE_URL` from secret
- **Main container**:
  - Image from `values.image`
  - Port 3000
  - Environment variables from secret: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `NODE_ENV=production`
  - Optional OIDC env vars from secret (only rendered if values are set)
  - Volume mounts: `/downloads` and `/media`
  - Command override: `["node", "build"]` (skip migrations since init container handles them)
- Volumes reference the PVCs

### deployment/postgresql.yaml

- Conditional on `postgresql.enabled`
- Single-replica Deployment, `Recreate` strategy
- `postgres:18-alpine` image
- Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from values
- Liveness/readiness probe: `pg_isready -U <user>`
- Volume mount for data persistence

### service/wytui.yaml

- ClusterIP service
- Port 3000 targeting container port 3000
- Selector: `app: wytui`

### service/postgresql.yaml

- Conditional on `postgresql.enabled`
- ClusterIP service
- Port 5432
- Selector: `app: wytui-postgresql`

### service/ingress.yaml

- Conditional on `ingress.enabled`
- Single host rule: `values.ingress.domain` -> wytui service port 3000
- Optional TLS block
- IngressClassName from values
- Annotations pass-through

### volumes/downloads.yaml

- PVC for downloads cache
- Size, storageClass, accessModes from `values.downloads.persistent`

### volumes/library.yaml

- PVC for permanent media library
- Size, storageClass, accessModes from `values.library.persistent`

### volumes/postgresql.yaml

- Conditional on `postgresql.enabled`
- PVC for PostgreSQL data
- Size, storageClass, accessModes from `values.postgresql.persistent`

### config/secret.yaml

- Conditional on `!secret.existing`
- Contains:
  - `DATABASE_URL`: constructed from postgresql values when bundled, or from `externalDatabase.url` when external
  - `AUTH_SECRET`: from values (required — user must set this)
  - `OIDC_NAME`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`: only included if set

### _helpers.tpl

- Helper to construct `DATABASE_URL` from postgresql values: `postgresql://user:pass@wytui-postgresql:5432/db?schema=public`
- Helper for common labels

## GitHub Actions Workflow

Add a `helm` job to `.github/workflows/docker-publish.yml` that runs after `merge`:

```yaml
helm:
  runs-on: ubuntu-latest
  if: github.event_name != 'pull_request'
  needs: merge
  permissions:
    contents: read
    packages: write
  steps:
    - Checkout repository
    - Install Helm
    - Login to GHCR (helm registry login)
    - Package chart (helm package charts/wytui)
    - Push to GHCR (helm push wytui-*.tgz oci://ghcr.io/willuhmjs)
```

The chart version in `Chart.yaml` determines the package version. When tagging releases, the workflow could update `appVersion` too, but for now we keep it simple with manual version bumps.

## README Update

Add a "Helm" section under Quick Start:

```markdown
### Helm

\```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui
\```

With custom values:
\```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui -f values.yaml
\```

The chart includes a bundled PostgreSQL by default. To use an external database:
\```yaml
postgresql:
  enabled: false
externalDatabase:
  url: "postgresql://user:pass@host:5432/wytui?schema=public"
\```
```

## Non-Goals

- No Helm subchart dependency for PostgreSQL (Bitnami etc.) — we keep it simple like arr-stack with an inline deployment
- No HPA or PodDisruptionBudget — single-replica app
- No NetworkPolicies — keep it simple
- No NOTES.txt — arr-stack doesn't use one either
