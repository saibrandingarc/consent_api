# consent_api

NestJS API + Prisma (Azure SQL / local SQL Server). Own Azure App Service.

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

Node **22** Linux Web App. GitHub secret `AZUREAPPSERVICE_PUBLISHPROFILE`. Optional variables: `AZURE_API_APP`, `WEB_URL`, `ADMIN_URL`. CORS uses `WEB_URL` and `ADMIN_URL`.
