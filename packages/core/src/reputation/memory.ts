import { randomUUID } from "node:crypto";
import { computeScore } from "./reputation.js";
import type { ReputationEvidence, ReputationService } from "./reputation.js";

const nowIso = () => new Date().toISOString();

const LATEST_N = 10;

interface StoredEntry {
  id: string;
  actorId: string;
  capability: string;
  score: number;
  evidence: ReputationEvidence;
  createdAt: string;
}

export function createInMemoryReputationService(): ReputationService {
  const entries: StoredEntry[] = [];

  return {
    async record(actorId, capability, evidence) {
      const score = computeScore(evidence.feedback, evidence.verified);
      entries.push({
        id: randomUUID(),
        actorId,
        capability,
        score,
        evidence,
        createdAt: nowIso(),
      });
      return score;
    },

    async scores(actorId) {
      const relevant = entries
        .filter((e) => e.actorId === actorId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const buckets = new Map<string, number[]>();
      for (const e of relevant) {
        const list = buckets.get(e.capability) ?? [];
        if (list.length < LATEST_N) list.push(e.score);
        buckets.set(e.capability, list);
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
