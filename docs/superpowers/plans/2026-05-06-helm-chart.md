# wytui Helm Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Helm chart for deploying wytui to Kubernetes, with CI packaging to GHCR and README installation docs.

**Architecture:** Single-chart deployment following arr-stack's flat template style (no `helm create` boilerplate). The chart deploys the wytui app with an init container for DB migrations, an optional bundled PostgreSQL, PVCs for downloads/library/pgdata, a Secret for credentials, and an Ingress. The GitHub workflow adds a `helm` job that packages and pushes the chart as an OCI artifact to ghcr.io.

**Tech Stack:** Helm 3, Kubernetes, GitHub Actions, GHCR OCI registry

**Spec:** `docs/superpowers/specs/2026-05-06-helm-chart-design.md`

**Style reference:** `../arr-stack/charts/arr-stack/` — follow its template formatting (raw templates, no NOTES.txt, minimal helpers, namespace via `{{ .Release.Namespace }}`)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `charts/wytui/Chart.yaml` | Chart metadata |
| Create | `charts/wytui/values.yaml` | Default configuration |
| Create | `charts/wytui/.helmignore` | Helm package exclusions |
| Create | `charts/wytui/templates/_helpers.tpl` | Template helpers (DATABASE_URL builder) |
| Create | `charts/wytui/templates/config/secret.yaml` | Secret for app credentials |
| Create | `charts/wytui/templates/volumes/downloads.yaml` | PVC for download cache |
| Create | `charts/wytui/templates/volumes/library.yaml` | PVC for media library |
| Create | `charts/wytui/templates/volumes/postgresql.yaml` | PVC for PostgreSQL data (conditional) |
| Create | `charts/wytui/templates/deployment/wytui.yaml` | App deployment with init container |
| Create | `charts/wytui/templates/deployment/postgresql.yaml` | PostgreSQL deployment (conditional) |
| Create | `charts/wytui/templates/service/wytui.yaml` | ClusterIP service for app |
| Create | `charts/wytui/templates/service/postgresql.yaml` | ClusterIP service for PostgreSQL (conditional) |
| Create | `charts/wytui/templates/service/ingress.yaml` | Ingress (conditional) |
| Modify | `.github/workflows/docker-publish.yml` | Add `helm` job for OCI packaging |
| Modify | `README.md` | Add Helm installation section |

---

### Task 1: Chart Scaffolding

**Files:**
- Create: `charts/wytui/Chart.yaml`
- Create: `charts/wytui/values.yaml`
- Create: `charts/wytui/.helmignore`

- [ ] **Step 1: Create Chart.yaml**

```yaml
apiVersion: v2
name: wytui
description: Self-hosted web UI for yt-dlp
type: application
version: 0.1.0
appVersion: "latest"
```

- [ ] **Step 2: Create values.yaml**

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
  authSecret: ""
  oidcName: ""
  oidcClientId: ""
  oidcClientSecret: ""
  oidcIssuer: ""

postgresql:
  enabled: true
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
  url: ""

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

- [ ] **Step 3: Create .helmignore**

```
.DS_Store
.git
.gitignore
.idea
*.swp
*.bak
*.tmp
```

- [ ] **Step 4: Commit**

```bash
git add charts/wytui/Chart.yaml charts/wytui/values.yaml charts/wytui/.helmignore
git commit -m "feat: add helm chart scaffolding (Chart.yaml, values.yaml, .helmignore)"
```

---

### Task 2: Template Helpers

**Files:**
- Create: `charts/wytui/templates/_helpers.tpl`

- [ ] **Step 1: Create _helpers.tpl**

This file provides two helpers:
1. `wytui.databaseUrl` — constructs DATABASE_URL from postgresql values when bundled, or uses externalDatabase.url when external
2. `wytui.appEnv` — common environment variables injected into the wytui container and init container

```yaml
{{/*
Construct DATABASE_URL from postgresql values or external URL.
Usage: {{ include "wytui.databaseUrl" . }}
*/}}
{{- define "wytui.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
postgresql://{{ .Values.postgresql.username }}:{{ .Values.postgresql.password }}@wytui-postgresql:5432/{{ .Values.postgresql.database }}?schema=public
{{- else -}}
{{ .Values.externalDatabase.url }}
{{- end -}}
{{- end }}

{{/*
Common app environment variables from secret.
Usage: {{- include "wytui.appEnv" . | nindent 8 }}
*/}}
{{- define "wytui.appEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: DATABASE_URL
- name: AUTH_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: AUTH_SECRET
- name: AUTH_TRUST_HOST
  value: "true"
- name: NODE_ENV
  value: "production"
{{- if .Values.secret.oidcName }}
- name: OIDC_NAME
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: OIDC_NAME
{{- end }}
{{- if .Values.secret.oidcClientId }}
- name: OIDC_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: OIDC_CLIENT_ID
{{- end }}
{{- if .Values.secret.oidcClientSecret }}
- name: OIDC_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: OIDC_CLIENT_SECRET
{{- end }}
{{- if .Values.secret.oidcIssuer }}
- name: OIDC_ISSUER
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secret.name }}
      key: OIDC_ISSUER
{{- end }}
{{- end }}
```

- [ ] **Step 2: Commit**

```bash
git add charts/wytui/templates/_helpers.tpl
git commit -m "feat: add helm template helpers for DATABASE_URL and app env"
```

---

### Task 3: Secret Template

**Files:**
- Create: `charts/wytui/templates/config/secret.yaml`

- [ ] **Step 1: Create config/secret.yaml**

```yaml
{{- if not .Values.secret.existing }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.secret.name }}
  namespace: {{ .Release.Namespace }}
type: Opaque
stringData:
  DATABASE_URL: {{ include "wytui.databaseUrl" . | quote }}
  AUTH_SECRET: {{ .Values.secret.authSecret | quote }}
{{- if .Values.secret.oidcName }}
  OIDC_NAME: {{ .Values.secret.oidcName | quote }}
{{- end }}
{{- if .Values.secret.oidcClientId }}
  OIDC_CLIENT_ID: {{ .Values.secret.oidcClientId | quote }}
{{- end }}
{{- if .Values.secret.oidcClientSecret }}
  OIDC_CLIENT_SECRET: {{ .Values.secret.oidcClientSecret | quote }}
{{- end }}
{{- if .Values.secret.oidcIssuer }}
  OIDC_ISSUER: {{ .Values.secret.oidcIssuer | quote }}
{{- end }}
{{- end }}
```

- [ ] **Step 2: Commit**

```bash
git add charts/wytui/templates/config/secret.yaml
git commit -m "feat: add secret template for app credentials"
```

---

### Task 4: PersistentVolumeClaims

**Files:**
- Create: `charts/wytui/templates/volumes/downloads.yaml`
- Create: `charts/wytui/templates/volumes/library.yaml`
- Create: `charts/wytui/templates/volumes/postgresql.yaml`

- [ ] **Step 1: Create volumes/downloads.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wytui-downloads
  namespace: {{ .Release.Namespace }}
  labels:
    app: wytui-downloads
spec:
  storageClassName: {{ .Values.downloads.persistent.storageClass }}
  accessModes:
    {{- toYaml .Values.downloads.persistent.accessModes | nindent 4 }}
  resources:
    requests:
      storage: {{ .Values.downloads.persistent.size }}
```

- [ ] **Step 2: Create volumes/library.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wytui-library
  namespace: {{ .Release.Namespace }}
  labels:
    app: wytui-library
spec:
  storageClassName: {{ .Values.library.persistent.storageClass }}
  accessModes:
    {{- toYaml .Values.library.persistent.accessModes | nindent 4 }}
  resources:
    requests:
      storage: {{ .Values.library.persistent.size }}
```

- [ ] **Step 3: Create volumes/postgresql.yaml**

```yaml
{{- if .Values.postgresql.enabled }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wytui-postgresql
  namespace: {{ .Release.Namespace }}
  labels:
    app: wytui-postgresql
spec:
  storageClassName: {{ .Values.postgresql.persistent.storageClass }}
  accessModes:
    {{- toYaml .Values.postgresql.persistent.accessModes | nindent 4 }}
  resources:
    requests:
      storage: {{ .Values.postgresql.persistent.size }}
{{- end }}
```

- [ ] **Step 4: Commit**

```bash
git add charts/wytui/templates/volumes/
git commit -m "feat: add PVC templates for downloads, library, and postgresql"
```

---

### Task 5: PostgreSQL Deployment and Service

**Files:**
- Create: `charts/wytui/templates/deployment/postgresql.yaml`
- Create: `charts/wytui/templates/service/postgresql.yaml`

- [ ] **Step 1: Create deployment/postgresql.yaml**

```yaml
{{- if .Values.postgresql.enabled }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wytui-postgresql
  namespace: {{ .Release.Namespace }}
  labels:
    app: wytui-postgresql
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: wytui-postgresql
  template:
    metadata:
      labels:
        app: wytui-postgresql
    spec:
      containers:
      - name: postgresql
        image: {{ .Values.postgresql.image }}
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: {{ .Values.postgresql.username | quote }}
        - name: POSTGRES_PASSWORD
          value: {{ .Values.postgresql.password | quote }}
        - name: POSTGRES_DB
          value: {{ .Values.postgresql.database | quote }}
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - {{ .Values.postgresql.username }}
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - {{ .Values.postgresql.username }}
          initialDelaySeconds: 15
          periodSeconds: 10
        volumeMounts:
        - name: postgresql-data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgresql-data
        persistentVolumeClaim:
          claimName: wytui-postgresql
{{- end }}
```

- [ ] **Step 2: Create service/postgresql.yaml**

```yaml
{{- if .Values.postgresql.enabled }}
apiVersion: v1
kind: Service
metadata:
  name: wytui-postgresql
  namespace: {{ .Release.Namespace }}
spec:
  selector:
    app: wytui-postgresql
  ports:
  - port: 5432
    targetPort: 5432
{{- end }}
```

- [ ] **Step 3: Commit**

```bash
git add charts/wytui/templates/deployment/postgresql.yaml charts/wytui/templates/service/postgresql.yaml
git commit -m "feat: add postgresql deployment and service templates"
```

---

### Task 6: wytui Deployment

**Files:**
- Create: `charts/wytui/templates/deployment/wytui.yaml`

- [ ] **Step 1: Create deployment/wytui.yaml**

The init container runs Prisma migrations before the app starts. The main container runs `node build` directly (migrations already done by init container).

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wytui
  namespace: {{ .Release.Namespace }}
  labels:
    app: wytui
spec:
  replicas: 1
  strategy:
    type: {{ .Values.strategy.type }}
  selector:
    matchLabels:
      app: wytui
  template:
    metadata:
      labels:
        app: wytui
    spec:
      securityContext:
        fsGroup: 1001
      initContainers:
      - name: migrate
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        command: ["npx", "prisma", "migrate", "deploy"]
        env:
        {{- include "wytui.appEnv" . | nindent 8 }}
      containers:
      - name: wytui
        image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        command: ["node", "build"]
        ports:
        - containerPort: 3000
        env:
        {{- include "wytui.appEnv" . | nindent 8 }}
        volumeMounts:
        - name: downloads
          mountPath: /downloads
        - name: library
          mountPath: /media
      volumes:
      - name: downloads
        persistentVolumeClaim:
          claimName: wytui-downloads
      - name: library
        persistentVolumeClaim:
          claimName: wytui-library
```

- [ ] **Step 2: Commit**

```bash
git add charts/wytui/templates/deployment/wytui.yaml
git commit -m "feat: add wytui deployment with init container for migrations"
```

---

### Task 7: wytui Service and Ingress

**Files:**
- Create: `charts/wytui/templates/service/wytui.yaml`
- Create: `charts/wytui/templates/service/ingress.yaml`

- [ ] **Step 1: Create service/wytui.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: wytui
  namespace: {{ .Release.Namespace }}
spec:
  selector:
    app: wytui
  ports:
  - port: 3000
    targetPort: 3000
```

- [ ] **Step 2: Create service/ingress.yaml**

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wytui
  namespace: {{ .Release.Namespace }}
{{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
{{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
{{- if .Values.ingress.tls.enabled }}
  tls:
  - hosts:
    - {{ .Values.ingress.domain }}
    secretName: {{ .Values.ingress.tls.secretName }}
{{- end }}
  rules:
  - host: {{ .Values.ingress.domain }}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wytui
            port:
              number: 3000
{{- end }}
```

- [ ] **Step 3: Commit**

```bash
git add charts/wytui/templates/service/wytui.yaml charts/wytui/templates/service/ingress.yaml
git commit -m "feat: add wytui service and ingress templates"
```

---

### Task 8: Validate Chart with helm lint

- [ ] **Step 1: Install Helm (if needed) and lint**

Run: `helm lint charts/wytui`

Expected output:
```
==> Linting charts/wytui
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
```

No errors. If there are errors, fix the templates and re-lint before proceeding.

- [ ] **Step 2: Dry-run template rendering**

Run: `helm template wytui charts/wytui --set secret.authSecret=test-secret`

Expected: Full rendered YAML for all resources — Deployment (wytui + init container), PostgreSQL Deployment, 3 PVCs, 2 Services, Ingress, Secret. Review for correctness.

- [ ] **Step 3: Dry-run with postgresql disabled**

Run: `helm template wytui charts/wytui --set secret.authSecret=test-secret --set postgresql.enabled=false --set externalDatabase.url="postgresql://ext:pass@db:5432/wytui"`

Expected: No postgresql Deployment, Service, or PVC rendered. DATABASE_URL in Secret should be the external URL.

---

### Task 9: GitHub Actions Workflow Update

**Files:**
- Modify: `.github/workflows/docker-publish.yml`

- [ ] **Step 1: Add `helm` job after the `merge` job**

Append this job to the end of the workflow file, at the same indentation level as `build` and `merge`:

```yaml
  helm:
    runs-on: ubuntu-latest
    if: github.event_name != 'pull_request'
    needs: merge
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Helm
        uses: azure/setup-helm@v4

      - name: Login to GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | helm registry login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Package chart
        run: helm package charts/wytui

      - name: Push chart to GHCR
        run: helm push wytui-*.tgz oci://ghcr.io/${{ github.repository_owner }}
```

Note: uses `github.repository_owner` (lowercase) so the OCI path is `oci://ghcr.io/willuhmjs/wytui`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/docker-publish.yml
git commit -m "feat: add helm chart packaging and push to GHCR OCI"
```

---

### Task 10: README Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Helm section after the Docker Compose section**

Insert this block after the closing `` ``` `` of the Docker Compose YAML (after line 51, before `### Environment Variables`):

```markdown
### Helm

```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui
```

With custom values:

```bash
helm install wytui oci://ghcr.io/willuhmjs/wytui -f values.yaml
```

The chart includes a bundled PostgreSQL by default. To use an external database:

```yaml
postgresql:
  enabled: false
externalDatabase:
  url: "postgresql://user:pass@host:5432/wytui?schema=public"
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add helm installation instructions to README"
```

---

### Task 11: Final Validation

- [ ] **Step 1: Re-lint after all changes**

Run: `helm lint charts/wytui`

Expected: 0 charts failed.

- [ ] **Step 2: Full template render with all options**

Run: `helm template wytui charts/wytui --set secret.authSecret=mysecret --set secret.oidcName=Authelia --set secret.oidcClientId=wytui --set secret.oidcClientSecret=secret --set secret.oidcIssuer=https://auth.example.com`

Expected: Secret includes all OIDC fields. wytui Deployment env includes OIDC_NAME, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER.

- [ ] **Step 3: Verify existing secret mode**

Run: `helm template wytui charts/wytui --set secret.existing=true --set secret.name=my-existing-secret`

Expected: No Secret resource rendered. Deployments reference `my-existing-secret` for env valueFrom.
