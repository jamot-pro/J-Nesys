import { Pool } from "pg";
import { loadConfig } from "./config.js";
import { createLogger } from "./logging/logger.js";
import { createMetrics } from "./metrics/metrics.js";
import { createMapsProvider } from "./provider/MapsProvider.js";
import { PgJobQueue } from "./jobs/queue.js";
import { JobManager } from "./jobs/manager.js";
import { DatabaseWriter } from "./db/writer.js";
import { CoverageTracker } from "./geo/coverage.js";
import { createApiServer } from "./api/server.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.workerId);

  if (!config.enabled) {
    logger.info("worker_disabled", {});
    return;
  }

  const pool = new Pool({ connectionString: config.databaseUrl });
  const metrics = createMetrics();
  const provider = await createMapsProvider(config.provider);
  const queue = new PgJobQueue(pool);
  const writer = new DatabaseWriter(pool);
  const coverage = new CoverageTracker(pool);

  const manager = new JobManager(queue, provider, writer, logger, metrics, {
    workerId: config.workerId,
    concurrency: config.concurrency,
    jobTimeoutMs: config.jobTimeoutMs,
    retryCount: config.retryCount,
    retryBackoffMs: config.retryBackoffMs,
    pollIntervalMs: config.pollIntervalMs,
  });
  await manager.start();

  const server = createApiServer({ queue, coverage, metrics, provider, config, writer });
  server.listen(config.port, () => {
    logger.info("worker_listening", { port: config.port });
  });

  const shutdown = async (signal: string) => {
    logger.info("worker_shutting_down", { signal });
    manager.stop();
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "error", event: "fatal_startup_error", error: err.message }));
  process.exit(1);
});
