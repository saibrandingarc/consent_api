# consent_api

Independent NestJS API. **consent_web** and **consent_admin** call this service; they are not bundled with it.

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

Secret `AZUREAPPSERVICE_PUBLISHPROFILE`. App name default `consentapi`.
