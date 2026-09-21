# consent_api

Independent NestJS API in its own GitHub repo and Azure App Service (`consentapi`). **consent_web** and **consent_admin** call it over HTTP only; they are not built or deployed with this app.

Set these App Service settings so CORS allows the two UIs:

- `WEB_URL=https://consentmngtdev-gtfgamd4c9b4bbcr.eastus2-01.azurewebsites.net`
- `ADMIN_URL=https://consentadmin-fwb7gmeybmhwhyd0.eastus2-01.azurewebsites.net`

## Local

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev   # http://localhost:4000/api/v1
```

## Azure

Node **22** Linux Web App `consentapi`:
https://consentapi-abgrbph5cfccbxe0.eastus2-01.azurewebsites.net

GitHub Actions zips **source only**. **Kudu** runs `deploy/azure/remote-build.sh` (`pnpm install` + `pnpm build`). Do not use Oryx. Set (see `deploy/azure/env.example`):

- `ENABLE_ORYX_BUILD=false`
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
- Startup command: `node host.js`

Secret `AZUREAPPSERVICE_PUBLISHPROFILE`. App name default `consentapi`.
