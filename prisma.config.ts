import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Placeholder keeps `prisma generate` offline-safe; real URL comes from .env.
    // For `prisma migrate`, point DATABASE_URL at DIRECT_URL first.
    url:
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/covermint",
  },
});
