import type { MapsProvider } from "../provider/MapsProvider.js";
import type { JobQueue } from "./queue.js";
import type { DatabaseWriter } from "../db/writer.js";
import { normalizePlace } from "../normalize/normalizer.js";
import type { Logger } from "../logging/logger.js";
import type { Metrics } from "../metrics/metrics.js";
import type { ScrapeJob } from "../types.js";

export interface JobManagerConfig {
  workerId: string;
  concurrency: number;
  jobTimeoutMs: number;
  retryCount: number;
  retryBackoffMs: number;
  pollIntervalMs: number;
}

/**
 * Picks up queued jobs, runs them through the pipeline (search -> parse ->
 * normalize -> dedup -> write), and updates job status. A failure anywhere in
 * one job's pipeline is caught and recorded on that job — it must never take
 * down the process, since Jamot Core's contract with this worker is "a
 * scraper crash does not crash Jamot Core", which starts with "does not crash
 * this worker either".
 */
export class JobManager {
  private stopped = false;
  private inFlight = 0;

  constructor(
    private readonly queue: JobQueue,
    private readonly provider: MapsProvider,
    private readonly writer: DatabaseWriter,
    private readonly logger: Logger,
    private readonly metrics: Metrics,
    private readonly config: JobManagerConfig,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
  }

  private async loop(): Promise<void> {
    while (!this.stopped) {
      const capacity = this.config.concurrency - this.inFlight;
      if (capacity > 0) {
        const jobs = await this.queue.claim(this.config.workerId, capacity);
        for (const job of jobs) {
          this.inFlight += 1;
          void this.runJob(job).finally(() => {
            this.inFlight -= 1;
          });
        }
      }
      await sleep(this.config.pollIntervalMs);
    }
  }

  private async runJob(job: ScrapeJob): Promise<void> {
    this.logger.info("job_started", { jobId: job.jobId, query: job.query });
    this.metrics.increment("jobs_total");

    const errors: string[] = [];
    let resultsFound = 0;
    let newRecords = 0;
    let duplicateRecords = 0;

    try {
      const timeout = withTimeout(this.config.jobTimeoutMs);

      this.logger.info("search_started", { jobId: job.jobId });
      const places = await timeout(
        withRetry(
          () =>
            this.provider.search({
              query: job.query,
              country: job.country,
              region: job.region,
              province: job.province,
              city: job.city,
              category: job.category,
            }),
          this.config.retryCount,
          this.config.retryBackoffMs,
        ),
      );
      resultsFound = places.length;
      this.logger.info("search_completed", { jobId: job.jobId, count: places.length });

      for (const place of places) {
        try {
          await this.writer.recordRawResult({
            jobId: job.jobId,
            provider: this.provider.id,
            rawPayload: place.raw,
          });

          const normalized = normalizePlace(place);
          const { outcome } = await this.writer.upsertPlace(normalized, job.jobId);

          if (outcome === "new") {
            newRecords += 1;
            this.metrics.increment("businesses_created");
            this.logger.info("merchant_created", { jobId: job.jobId, name: normalized.name });
          } else {
            duplicateRecords += 1;
            this.metrics.increment("duplicates_detected");
            this.logger.info("duplicate_detected", { jobId: job.jobId, name: normalized.name });
          }
          this.metrics.increment("businesses_discovered");
        } catch (err) {
          errors.push(`result_error: ${(err as Error).message}`);
          this.logger.error("provider_error", { jobId: job.jobId, error: (err as Error).message });
        }
      }

      await this.queue.markCompleted(job.jobId, {
        resultsFound,
        newRecords,
        duplicateRecords,
        errors,
      });
      this.metrics.increment(errors.length > 0 ? "jobs_failed" : "jobs_completed");
      this.logger.info("job_completed", {
        jobId: job.jobId,
        resultsFound,
        newRecords,
        duplicateRecords,
        errors: errors.length,
      });
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error("job_failed", { jobId: job.jobId, error: message });
      this.metrics.increment("jobs_failed");
      await this.queue.markFailed(job.jobId, message);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(ms: number) {
  return async function run<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
    ]);
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  backoffMs: number,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(backoffMs * 2 ** attempt);
    }
  }
  throw lastErr;
}
