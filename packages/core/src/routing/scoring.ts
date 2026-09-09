import type { RoleKind } from "../policy/policy-engine.js";

export type Availability = "available" | "busy" | "offline";

export interface CandidateInput {
  actorId: string;
  actorType: "human" | "agent";
  roleKind: RoleKind | null;
  capabilityIds: string[];
  skillIds: string[];
  performance: Record<string, number>;
  availability: Availability;
  budget: number | null;
  reputation: Record<string, number>;
  permissions: string[];
  latencyMs: number;
  continuity: number;
  risk: number;
}

export interface ScoringContext {
  requiredCapabilities: string[];
  requiredPermissions?: string[];
  risk: number;
}

export interface ScoringResult {
  total: number;
  breakdown: Record<string, number>;
}

export const CAPABILITY_FIT_WEIGHT = 0.25;
export const SKILL_FIT_WEIGHT = 0.15;
export const PERFORMANCE_WEIGHT = 0.1;
export const AVAILABILITY_WEIGHT = 0.1;
export const LATENCY_WEIGHT = 0.05;
export const COST_WEIGHT = 0.05;
export const CONTINUITY_WEIGHT = 0.05;
export const REPUTATION_WEIGHT = 0.1;
export const RISK_WEIGHT = 0.1;
export const PERMISSIONS_WEIGHT = 0.05;

const LATENCY_REF_MS = 5_000;
const COST_REF = 1_000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function overlap(required: string[], have: string[]): number {
  if (required.length === 0) return 1;
  const available = new Set(have);
  const matched = required.filter((item) => available.has(item)).length;
  return matched / required.length;
}

function average(values: number[]): number {
  if (values.length === 0) return 0.5;
  const sum = values.reduce((total, value) => total + value, 0);
  return clamp01(sum / values.length);
}

function capabilityFit(candidate: CandidateInput, ctx: ScoringContext): number {
  return overlap(ctx.requiredCapabilities, candidate.capabilityIds);
}

function skillFit(candidate: CandidateInput, ctx: ScoringContext): number {
  return overlap(ctx.requiredCapabilities, candidate.skillIds);
}

function historicalPerformance(candidate: CandidateInput): number {
  return average(Object.values(candidate.performance));
}

function availabilityScore(candidate: CandidateInput): number {
  if (candidate.availability === "available") return 1;
  if (candidate.availability === "busy") return 0.5;
  return 0;
}

function latencyScore(candidate: CandidateInput): number {
  return 1 - clamp01(candidate.latencyMs / LATENCY_REF_MS);
}

function costScore(candidate: CandidateInput): number {
  if (candidate.budget === null) return 0.5;
  return 1 - clamp01(candidate.budget / COST_REF);
}

function continuityScore(candidate: CandidateInput): number {
  return clamp01(candidate.continuity);
}

function reputationScore(candidate: CandidateInput): number {
  return average(Object.values(candidate.reputation));
}

function riskScore(candidate: CandidateInput, ctx: ScoringContext): number {
  return 1 - clamp01(candidate.risk + ctx.risk);
}

function permissionsScore(candidate: CandidateInput, ctx: ScoringContext): number {
  const required = ctx.requiredPermissions ?? [];
  if (required.length === 0) {
    return candidate.permissions.length > 0 ? 1 : 0.5;
  }
  return overlap(required, candidate.permissions);
}

export function scoreCandidate(
  candidate: CandidateInput,
  ctx: ScoringContext,
): ScoringResult {
  const breakdown: Record<string, number> = {
    capabilityFit: capabilityFit(candidate, ctx),
    skillFit: skillFit(candidate, ctx),
    performance: historicalPerformance(candidate),
    availability: availabilityScore(candidate),
    latency: latencyScore(candidate),
    cost: costScore(candidate),
    continuity: continuityScore(candidate),
    reputation: reputationScore(candidate),
    risk: riskScore(candidate, ctx),
    permissions: permissionsScore(candidate, ctx),
  };

  const weights: Record<string, number> = {
    capabilityFit: CAPABILITY_FIT_WEIGHT,
    skillFit: SKILL_FIT_WEIGHT,
    performance: PERFORMANCE_WEIGHT,
    availability: AVAILABILITY_WEIGHT,
    latency: LATENCY_WEIGHT,
    cost: COST_WEIGHT,
    continuity: CONTINUITY_WEIGHT,
    reputation: REPUTATION_WEIGHT,
    risk: RISK_WEIGHT,
    permissions: PERMISSIONS_WEIGHT,
  };

  let total = 0;
  for (const key of Object.keys(weights)) {
    total += (weights[key] ?? 0) * (breakdown[key] ?? 0);
  }

  return { total: clamp01(total), breakdown };
}
