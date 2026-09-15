// Local mirror of the subset of @jamot/contracts this app needs. Mobile J0.2
// is a standalone Vite app outside the pnpm workspace (its own lockfile, own
// React version), so it can't import @jamot/contracts directly — these types
// track packages/contracts/src/{person,task,common}.ts by hand.

export type Screen = "home" | "talk" | "tasks" | "profile";

export type TaskStatus = "created" | "assigned" | "started" | "completed" | "cancelled";

export interface Task {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeActorIds: string[];
  outcome: Record<string, unknown> | null;
  dueDate: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileAttribute<T = unknown> {
  value: T;
  source: "self_declared" | "assessment" | "observed" | "manager_feedback" | "inferred" | "system";
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonProfile {
  selfDescribed: Record<string, ProfileAttribute>;
  integral: Record<string, ProfileAttribute>;
  skills: string[];
  preferences: Record<string, ProfileAttribute>;
  goals: string[];
}

export interface Person {
  id: string;
  actorId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  profile: PersonProfile;
  membershipSpaceIds: string[];
  reputation: Record<string, number>;
}

export interface MemoryEntry {
  id: string;
  scope: "person" | "agent" | "relationship" | "organization";
  ownerId: string;
  content: Record<string, unknown>;
  provenance: {
    source: string;
    confidence: number;
    createdAt: string;
    updatedAt: string;
  };
}

export interface AvailabilityRule {
  id: string;
  label: string;
  on: boolean;
}

export interface Availability {
  available: boolean;
  rules: AvailabilityRule[];
}

export interface ChatMessage {
  id: string;
  who: "you" | "jamot";
  text: string;
  action?: string;
}
