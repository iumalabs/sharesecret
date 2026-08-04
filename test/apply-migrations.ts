import { applyD1Migrations, env } from "cloudflare:test";

interface TestEnv extends Env {
  TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
}

await applyD1Migrations((env as TestEnv).DB, (env as TestEnv).TEST_MIGRATIONS);
