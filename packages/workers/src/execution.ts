import { pathToFileURL } from "node:url";
import { createDb, getDatabaseUrl } from "@jamot/core";
import { createPgRepository } from "@jamot/core/repository/pg";
import { withAdvisoryLock } from "@jamot/core/scheduler";
import { createHarnessRegistry } from "@jamot/core/harness";
import { createTaskExecutionProcessor } from "@jamot/core/execution";
import { createPostgresReputationService } from "@jamot/core/reputation";

export interface ExecutionWorkerOptions {
  databaseUrl?: string;
  intervalMs?: number;
}

// A distinct lock key from the scheduler's ("Jamot" in hex) so the two
// workers never contend for the same advisory lock.
const EXECUTION_LOCK_ID = 0x4a616d6578;

export async function startExecutionWorker(
  opts: ExecutionWorkerOptions = {},
): Promise<void> {
  const databaseUrl = opts.databaseUrl ?? getDatabaseUrl();
  const dbHandle = createDb(databaseUrl);
  const repo = createPgRepository(dbHandle);
  const harness = createHarnessRegistry();
  const reputation = createPostgresReputationService(dbHandle);
  const processor = createTaskExecutionProcessor(repo, harness, reputation);

  const intervalMs = opts.intervalMs ?? 15_000;

  for (;;) {
    await withAdvisoryLock(dbHandle.pool, EXECUTION_LOCK_ID, async () => {
      const result = await processor.processDue();
      if (result.executed > 0 || result.blocked > 0 || result.failed > 0) {
        console.log("[execution]", result);
      }
    });
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  void startExecutionWorker();
}
