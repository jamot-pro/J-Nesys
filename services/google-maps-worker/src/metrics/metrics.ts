const COUNTERS = [
  "jobs_total",
  "jobs_completed",
  "jobs_failed",
  "businesses_discovered",
  "businesses_created",
  "businesses_updated",
  "duplicates_detected",
  "provider_errors",
] as const;

export type CounterName = (typeof COUNTERS)[number];

/**
 * In-process counters exposed via GET /metrics. Good enough for the pilot;
 * swap for a Prometheus client if this worker ever runs multiple replicas
 * whose metrics need aggregating centrally.
 */
export interface Metrics {
  increment(name: CounterName, by?: number): void;
  snapshot(): Record<string, number>;
}

export function createMetrics(): Metrics {
  const counters = new Map<string, number>(COUNTERS.map((name) => [name, 0]));
  const durations: number[] = [];

  return {
    increment(name, by = 1) {
      counters.set(name, (counters.get(name) ?? 0) + by);
    },
    snapshot() {
      const out: Record<string, number> = Object.fromEntries(counters);
      out.average_job_duration_ms =
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      return out;
    },
  };
}
