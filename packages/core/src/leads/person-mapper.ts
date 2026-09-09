import type { Person, PersonProfile, RawLead } from "@jamot/contracts";

/**
 * Maps a normalized RawLead onto a Jamot Person profile, preserving provenance
 * on every derived attribute. Nothing is a "fact" without a source — every
 * profile attribute carries source + confidence, and the originating provider
 * payload is kept on the membership row.
 */

const nowIso = () => new Date().toISOString();

function attribute(
  value: unknown,
  source: "observed" | "inferred" | "system" = "observed",
  confidence?: number,
) {
  const timestamp = nowIso();
  return {
    value,
    source,
    confidence: typeof confidence === "number" ? confidence : 0.6,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const setIf = (profile: PersonProfile["integral"], key: string, value: unknown, confidence?: number) => {
  if (value === undefined || value === null || value === "") return;
  profile[key] = attribute(value, "observed", confidence);
};

export interface PersonLeadMapping {
  /** Display name used for the actor + person. */
  displayName: string;
  email: string | null;
  profile: PersonProfile;
}

export function rawLeadToPerson(lead: RawLead): PersonLeadMapping {
  const displayName =
    [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() ||
    lead.company ||
    (lead.email ? lead.email.split("@")[0] ?? "" : "") ||
    "Unknown lead";

  const profile: PersonProfile = {
    selfDescribed: {},
    integral: {},
    skills: [],
    preferences: {},
    goals: [],
  };

  const confidence = lead.confidence;
  setIf(profile.integral, "title", lead.title, confidence);
  setIf(profile.integral, "seniority", lead.seniority, confidence);
  setIf(profile.integral, "company", lead.company, confidence);
  setIf(profile.integral, "industry", lead.industry, confidence);
  setIf(profile.integral, "companySize", lead.companySize, confidence);
  setIf(profile.integral, "location", lead.location, confidence);
  setIf(profile.integral, "hqLocation", lead.hqLocation, confidence);
  setIf(profile.integral, "linkedinUrl", lead.linkedinUrl, confidence);
  setIf(profile.integral, "website", lead.website, confidence);
  setIf(profile.integral, "phone", lead.phone, confidence);
  if (Object.keys(lead.extra).length > 0) {
    setIf(profile.integral, "extra", lead.extra, confidence);
  }

  // The email itself is a core identity field with provenance.
  if (lead.email) {
    profile.integral.email = attribute(lead.email, "observed", confidence);
  }

  return {
    displayName,
    email: lead.email,
    profile,
  };
}

export function toPersonInput(
  lead: RawLead,
  spaceId: string,
): { displayName: string; email: string | null; profile: PersonProfile; membershipSpaceIds: string[] } {
  const mapping = rawLeadToPerson(lead);
  return {
    displayName: mapping.displayName,
    email: mapping.email,
    profile: mapping.profile,
    membershipSpaceIds: [spaceId],
  };
}

export function personToLeadView(person: Person, actorDisplayName: string | null): Record<string, unknown> {
  const integral = person.profile?.integral ?? {};
  return {
    personId: person.id,
    actorId: person.actorId,
    displayName: actorDisplayName ?? "Unknown",
    email: person.email,
    title: (integral.title?.value as string) ?? "",
    seniority: (integral.seniority?.value as string) ?? "",
    company: (integral.company?.value as string) ?? "",
    industry: (integral.industry?.value as string) ?? "",
    companySize: (integral.companySize?.value as string) ?? "",
    location: (integral.location?.value as string) ?? "",
    linkedinUrl: (integral.linkedinUrl?.value as string | null) ?? null,
  };
}