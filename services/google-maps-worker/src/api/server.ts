import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { CreateJobInput, JobQueue } from "../jobs/queue.js";
import type { CoverageTracker } from "../geo/coverage.js";
import type { Metrics } from "../metrics/metrics.js";
import type { MapsProvider } from "../provider/MapsProvider.js";
import type { WorkerConfig } from "../config.js";
import type { DatabaseWriter } from "../db/writer.js";

/**
 * Internal HTTP API for Jamot Core. No dependency on any web framework — the
 * surface is small enough that plain node:http keeps this service's
 * dependency footprint minimal, per "keep scraper-specific dependencies
 * inside this service, don't add unnecessary deps to Jamot Core" applied in
 * reverse (don't add unnecessary deps here either).
 *
 * Auth: every request except /health must carry
 * `Authorization: Bearer <MAPS_WORKER_INTERNAL_TOKEN>` when that token is
 * configured. Never expose this endpoint or the token to frontend clients.
 */
export function createApiServer(deps: {
  queue: JobQueue;
  coverage: CoverageTracker;
  metrics: Metrics;
  provider: MapsProvider;
  config: WorkerConfig;
  writer: DatabaseWriter;
}) {
  const { queue, coverage, metrics, provider, config, writer } = deps;

  return createServer(async (req, res) => {
    try {
      if (req.url === "/health" && req.method === "GET") {
        const health = await provider.healthCheck();
        return json(res, health.healthy ? 200 : 503, health);
      }

      if (!authorized(req, config)) {
        return json(res, 401, { error: "unauthorized" });
      }

      if (req.url === "/metrics" && req.method === "GET") {
        return json(res, 200, metrics.snapshot());
      }

      if (req.url === "/coverage" && req.method === "GET") {
        return json(res, 200, await coverage.listCoverage());
      }

      if (req.url === "/jobs" && req.method === "POST") {
        const body = (await readJson(req)) as unknown as CreateJobInput;
        if (!body.query || !body.country) return json(res, 400, { error: "query and country are required" });
        const job = await queue.enqueue(body);
        return json(res, 201, { job_id: job.jobId, status: job.status });
      }

      if (req.url === "/jobs" && req.method === "GET") {
        return json(res, 200, await queue.list());
      }

      const jobMatch = req.url?.match(/^\/jobs\/([^/]+)(\/(cancel|pause|resume|results))?$/);
      if (jobMatch && req.method === "POST") {
        const [, jobId, , action] = jobMatch;
        if (action === "cancel") await queue.cancel(jobId!);
        else if (action === "pause") await queue.pause(jobId!);
        else if (action === "resume") await queue.resume(jobId!);
        else return json(res, 404, { error: "not_found" });
        return json(res, 200, { job_id: jobId, status: action });
      }
      if (jobMatch && req.method === "GET" && !jobMatch[3]) {
        const job = await queue.get(jobMatch[1]!);
        return job ? json(res, 200, job) : json(res, 404, { error: "not_found" });
      }
      if (jobMatch && req.method === "GET" && jobMatch[3] === "results") {
        return json(res, 200, await writer.resultsForJob(jobMatch[1]!));
      }

      return json(res, 404, { error: "not_found" });
    } catch (err) {
      return json(res, 500, { error: (err as Error).message });
    }
  });
}

function authorized(req: IncomingMessage, config: WorkerConfig): boolean {
  if (!config.internalApiToken) return true;
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${config.internalApiToken}`;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
