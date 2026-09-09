import type { AgentProfile } from "@/components/agents/agents-data";
import type { PersonProfile } from "@/components/people/people-data";
import type { ApiAgent, OrganizationMember } from "@/lib/api-client";

const MEMBER_KIND_LABEL: Record<OrganizationMember["kind"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function memberToPersonProfile(
  member: OrganizationMember,
  orgName: string,
): PersonProfile {
  const role = member.title ?? MEMBER_KIND_LABEL[member.kind];
  return {
    id: `member-${member.personId}`,
    actorId: member.actorId,
    name: member.displayName,
    role,
    identity: {
      email: member.email ?? "",
      department: "",
      location: "Remote",
      timezone: "",
    },
    selfDescribed: {},
    integral: {},
    skills: [],
    experience: [],
    preferences: {},
    goals: [],
    availability: "Available",
    contributions: [],
    reputation: {
      reliability: 0.5,
      helpfulness: 0.5,
    },
    memory: {
      interactions: 0,
      notes: member.email
        ? [`Member of ${orgName} — reachable at ${member.email}.`]
        : [`Member of ${orgName} since ${new Date(member.membershipSince).toLocaleDateString()}.`],
    },
  };
}

export function agentToAgentProfile(agent: ApiAgent): AgentProfile {
  return {
    id: agent.id,
    actorId: agent.actorId,
    name: agent.role ?? agent.purpose ?? "Agent",
    role: agent.role ?? "Digital worker",
    availability: agent.availability,
    autonomy: agent.autonomy,
    skills: Object.entries(agent.performance).map(([name, proficiency]) => ({
      name,
      proficiency,
    })),
    channels: [],
    reportsTo: "",
    memory: { interactions: 0, notes: [] },
    tasks: { active: 0 },
    reputation: agent.performance,
  };
}