function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface WorkerConfig {
  enabled: boolean;
  workerId: string;
  concurrency: number;
  jobTimeoutMs: number;
  retryCount: number;
  retryBackoffMs: number;
  pollIntervalMs: number;
  provider: string;
  databaseUrl: string;
  port: number;
  /** Shared secret Jamot Core sends on internal requests; never exposed to frontend clients. */
  internalApiToken: string | null;
}

export function loadConfig(): WorkerConfig {
  return {
    enabled: (process.env.MAPS_WORKER_ENABLED ?? "true") === "true",
    workerId: process.env.WORKER_ID ?? `maps-worker-${process.pid}`,
    concurrency: intEnv("MAPS_WORKER_CONCURRENCY", 2),
    jobTimeoutMs: intEnv("MAPS_JOB_TIMEOUT", 1800) * 1000,
    retryCount: intEnv("MAPS_RETRY_COUNT", 3),
    retryBackoffMs: intEnv("MAPS_RETRY_BACKOFF_MS", 2000),
    pollIntervalMs: intEnv("MAPS_POLL_INTERVAL_MS", 5000),
    provider: process.env.MAPS_PROVIDER ?? "omkarcloud",
    databaseUrl: requireEnv("DATABASE_URL"),
    port: intEnv("PORT", 8081),
    internalApiToken: process.env.MAPS_WORKER_INTERNAL_TOKEN ?? null,
  };
}
