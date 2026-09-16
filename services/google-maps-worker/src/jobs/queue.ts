import type { Pool } from "pg";
import type { ScrapeJob } from "../types.js";

export interface CreateJobInput {
  jobType?: ScrapeJob["jobType"];
  query: string;
  country: string;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  category?: string | null;
  geoCellId?: string | null;
}

/**
 * Job queue backed directly by the maps_jobs table (status column as queue
 * state) rather than a separate broker. Good enough for the pilot's
 * concurrency; the interface is narrow enough to swap in Redis/BullMQ later
 * (see README "Queue") without touching JobManager's call sites.
 */
export interface JobQueue {
  enqueue(input: CreateJobInput): Promise<ScrapeJob>;
  /** Atomically claims up to `limit` queued jobs for this worker. */
  claim(workerId: string, limit: number): Promise<ScrapeJob[]>;
  get(jobId: string): Promise<ScrapeJob | null>;
  list(filter?: { status?: ScrapeJob["status"] }): Promise<ScrapeJob[]>;
  markRunning(jobId: string): Promise<void>;
  markCompleted(jobId: string, summary: Partial<ScrapeJob>): Promise<void>;
  markFailed(jobId: string, error: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
  pause(jobId: string): Promise<void>;
  resume(jobId: string): Promise<void>;
}

export class PgJobQueue implements JobQueue {
  constructor(private readonly pool: Pool) {}

  async enqueue(input: CreateJobInput): Promise<ScrapeJob> {
    const { rows } = await this.pool.query(
      `insert into maps_jobs (job_type, query, country, region, province, city, category, geo_cell_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        input.jobType ?? "google_maps_discovery",
        input.query,
        input.country,
        input.region ?? null,
        input.province ?? null,
        input.city ?? null,
        input.category ?? null,
        input.geoCellId ?? null,
      ],
    );
    return rowToJob(rows[0]);
  }

  async claim(workerId: string, limit: number): Promise<ScrapeJob[]> {
    // FOR UPDATE SKIP LOCKED lets multiple worker processes claim from the
    // same table without double-picking a job — required once concurrency
    // (MAPS_WORKER_CONCURRENCY) spans more than one process.
    const { rows } = await this.pool.query(
      `with claimed as (
         select job_id from maps_jobs
         where status = 'queued'
         order by created_at
         limit $2
         for update skip locked
       )
       update maps_jobs
       set status = 'running', started_at = now(), worker_id = $1
       where job_id in (select job_id from claimed)
       returning *`,
      [workerId, limit],
    );
    return rows.map(rowToJob);
  }

  async get(jobId: string): Promise<ScrapeJob | null> {
    const { rows } = await this.pool.query(`select * from maps_jobs where job_id = $1`, [jobId]);
    return rows[0] ? rowToJob(rows[0]) : null;
  }

  async list(filter?: { status?: ScrapeJob["status"] }): Promise<ScrapeJob[]> {
    if (filter?.status) {
      const { rows } = await this.pool.query(
        `select * from maps_jobs where status = $1 order by created_at desc limit 200`,
        [filter.status],
      );
      return rows.map(rowToJob);
    }
    const { rows } = await this.pool.query(
      `select * from maps_jobs order by created_at desc limit 200`,
    );
    return rows.map(rowToJob);
  }

  async markRunning(jobId: string): Promise<void> {
    await this.pool.query(
      `update maps_jobs set status = 'running', started_at = coalesce(started_at, now()) where job_id = $1`,
      [jobId],
    );
  }

  async markCompleted(jobId: string, summary: Partial<ScrapeJob>): Promise<void> {
    const status: ScrapeJob["status"] =
      summary.errors && summary.errors.length > 0 ? "partial" : "completed";
    await this.pool.query(
      `update maps_jobs
       set status = $2, completed_at = now(),
           results_found = $3, new_records = $4, duplicate_records = $5, errors = $6
       where job_id = $1`,
      [
        jobId,
        status,
        summary.resultsFound ?? 0,
        summary.newRecords ?? 0,
        summary.duplicateRecords ?? 0,
        JSON.stringify(summary.errors ?? []),
      ],
    );
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.pool.query(
      `update maps_jobs set status = 'failed', completed_at = now(), errors = errors || $2::jsonb
       where job_id = $1`,
      [jobId, JSON.stringify([error])],
    );
  }

  async cancel(jobId: string): Promise<void> {
    await this.pool.query(
      `update maps_jobs set status = 'cancelled', completed_at = now() where job_id = $1`,
      [jobId],
    );
  }

  async pause(jobId: string): Promise<void> {
    await this.pool.query(`update maps_jobs set status = 'paused' where job_id = $1`, [jobId]);
  }

  async resume(jobId: string): Promise<void> {
    await this.pool.query(`update maps_jobs set status = 'queued' where job_id = $1`, [jobId]);
  }
}

function rowToJob(row: Record<string, unknown>): ScrapeJob {
  return {
    jobId: row.job_id as string,
    jobType: row.job_type as ScrapeJob["jobType"],
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    status: row.status as ScrapeJob["status"],
    query: row.query as string,
    country: row.country as string,
    region: (row.region as string) ?? null,
    province: (row.province as string) ?? null,
    city: (row.city as string) ?? null,
    category: (row.category as string) ?? null,
    geoCellId: (row.geo_cell_id as string) ?? null,
    resultsFound: Number(row.results_found ?? 0),
    newRecords: Number(row.new_records ?? 0),
    duplicateRecords: Number(row.duplicate_records ?? 0),
    errors: Array.isArray(row.errors) ? (row.errors as string[]) : [],
    workerId: (row.worker_id as string) ?? null,
  };
}
