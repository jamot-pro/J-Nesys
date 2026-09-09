import { cronMatches } from "./cron.js";

export interface ScheduledJob {
  id: string;
  cron: string;
  run(): Promise<void>;
}

export interface JobRun {
  jobId: string;
  ran: boolean;
}

export interface Scheduler {
  register(job: ScheduledJob): void;
  runDue(now: Date): Promise<JobRun[]>;
}

function minuteKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function createScheduler(): Scheduler {
  const jobs = new Map<string, ScheduledJob>();
  const runKeys = new Set<string>();

  return {
    register(job) {
      jobs.set(job.id, job);
    },

    async runDue(now) {
      const results: JobRun[] = [];
      const key = minuteKey(now);
      for (const job of jobs.values()) {
        if (!cronMatches(job.cron, now)) {
          results.push({ jobId: job.id, ran: false });
          continue;
        }
        const runKey = `${job.id}:${key}`;
        if (runKeys.has(runKey)) {
          results.push({ jobId: job.id, ran: false });
          continue;
        }
        runKeys.add(runKey);
        await job.run();
        results.push({ jobId: job.id, ran: true });
      }
      return results;
    },
  };
}
