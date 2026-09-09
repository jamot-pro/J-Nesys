import type { Provenance } from "@jamot/contracts";

export interface ReputationEvidence {
  taskId?: string;
  outcome: Record<string, unknown>;
  feedback?: number;
  verified: boolean;
  provenance: Provenance;
}

export interface ReputationService {
  record(
    actorId: string,
    capability: string,
    evidence: ReputationEvidence,
  ): Promise<number>;
  scores(actorId: string): Promise<Record<string, number>>;
}

export function computeScore(
  feedback: number | undefined,
  verified: boolean,
): number {
  const base = feedback ?? 0.5;
  const weight = verified ? 1 : 0.5;
  return Math.round(base * weight * 100) / 100;
}
