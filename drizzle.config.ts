import { defineConfig } from "drizzle-kit";

// Legacy PostgreSQL config — runtime DB is MongoDB (see server/mongodb/).
// Kept for schema reference / optional migration tooling only.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
