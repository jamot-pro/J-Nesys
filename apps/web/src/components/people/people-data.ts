export type ProvenanceSource =
  | "self_declared"
  | "assessment"
  | "observed"
  | "manager_feedback"
  | "inferred";

export interface Attribute {
  value: string;
  source: ProvenanceSource;
  confidence: number;
}

export interface PersonProfile {
  id: string;
  actorId?: string;
  name: string;
  role: string;
  avatar?: string;
  identity: {
    email: string;
    department: string;
    location: string;
    timezone: string;
    reportsTo?: string;
  };
  selfDescribed: Record<string, Attribute>;
  integral: Record<string, Attribute>;
  skills: string[];
  experience: string[];
  preferences: Record<string, Attribute>;
  goals: string[];
  availability: string;
  contributions: string[];
  reputation: Record<string, number>;
  memory: {
    interactions: number;
    notes: string[];
  };
}

export function overallReputation(reputation: Record<string, number>): number {
  const values = Object.values(reputation);
  if (values.length === 0) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 100);
}
