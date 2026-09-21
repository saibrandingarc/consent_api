import path from 'node:path';
import { defineConfig } from 'prisma/config';

const databaseUrl =
  process.env.CM_DATABASE_URL ??
  'sqlserver://localhost:1433;database=cmp;user=sa;password=Placeholder_1;encrypt=true;trustServerCertificate=true';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: databaseUrl,
  },
});
