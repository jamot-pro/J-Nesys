import { desc, eq } from "drizzle-orm";
import type { Db } from "../db.js";
import { reputationEntries } from "../schema/index.js";
import { computeScore } from "./reputation.js";
import type { ReputationService } from "./reputation.js";

const LATEST_N = 10;

export function createPostgresReputationService(db: Db): ReputationService {
  const client = db.db;

  return {
    async record(actorId, capability, evidence) {
      const score = computeScore(evidence.feedback, evidence.verified);
      await client.insert(reputationEntries).values({
        actorId,
        capability,
        score: String(score),
        evidence: {
          taskId: evidence.taskId ?? null,
          outcome: evidence.outcome,
          feedback: evidence.feedback ?? null,
          verified: evidence.verified,
        },
        provenance: evidence.provenance,
      });
      return score;
    },

    async scores(actorId) {
      const rows = await client
        .select()
        .from(reputationEntries)
        .where(eq(reputationEntries.actorId, actorId))
        .orderBy(desc(reputationEntries.createdAt));
      const buckets = new Map<string, number[]>();
      for (const row of rows) {
        const list = buckets.get(row.capability) ?? [];
        if (list.length < LATEST_N) list.push(Number(row.score));
        buckets.set(row.capability, list);
      }
      const result: Record<string, number> = {};
      for (const [capability, list] of buckets) {
        const avg = list.reduce((a, b) => a + b, 0) / list.length;
        result[capability] = Math.round(avg * 100) / 100;
      }
      return result;
    },
  };
}
