export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initDataDirs, runMigrations } = await import("./lib/db/index");
    initDataDirs();
    runMigrations();

    const { ensureJwtSecret } = await import("./lib/config/index");
    ensureJwtSecret();
  }
}
