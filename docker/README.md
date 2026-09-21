# Docker images

## Important: build context must be the repo root

These Dockerfiles **cannot** be built with `docker/` as the build context.

The monorepo needs `package.json`, `apps/`, `packages/`, and `pnpm-lock.yaml` from the **repository root**.

### Correct

```bash
# Run from repository root (consent_management/project/)
docker build -f docker/Dockerfile.api -t cmp-api:latest .
docker build -f docker/Dockerfile.admin -t cmp-admin:latest .
docker build -f docker/Dockerfile.web -t cmp-web:latest .
```

### Wrong (causes `package.json not found`)

```bash
cd docker
docker build -f Dockerfile.api .
```

## Google Cloud Build / Cloud Run

| Setting | Value |
|---------|--------|
| **Configuration type** | Cloud Build configuration file (yaml) — **not Inline** |
| **Config file** | `cloudbuild.api.yaml` / `cloudbuild.admin.yaml` / `cloudbuild.web.yaml` |
| **Source directory** | leave empty (repo root) |

Do **not** use Inline config with `docker` as the build context — that sends only ~9 KB and fails with `package.json not found`.

### Switch an existing trigger from Inline → Repository config

1. Cloud Build → Triggers → edit your trigger
2. **Configuration** → select **Cloud Build configuration file (yaml or json)**
3. **Location** → **Repository**
4. **Cloud Build configuration file location**:
   - API trigger → `cloudbuild.api.yaml`
   - Admin trigger → `cloudbuild.admin.yaml`
   - Web trigger → `cloudbuild.web.yaml`
5. Save and re-run

### Manual docker build (repo root context)

| Setting | Value |
|---------|--------|
| **Build context** | `.` (repository root) |
| **Dockerfile path** | `docker/Dockerfile.api` |

Do **not** set the source directory to `docker`.

### Recommended: use `cloudbuild.yaml`

From the repo root:

```bash
gcloud builds submit --config=cloudbuild.yaml .
```

Or create a Cloud Build trigger that uses `cloudbuild.yaml` at the repository root (not a manual Dockerfile-only build pointed at `docker/`).
