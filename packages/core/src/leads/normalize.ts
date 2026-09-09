import type { RawLead } from "@jamot/contracts";

/**
 * Normalize an arbitrary provider payload into the canonical RawLead shape.
 *
 * Providers disagree wildly on field naming (Apollo snake_case, LinkedIn
 * camelCase, MCP tools free-form). We try a small set of aliases per field and
 * keep the original payload under `raw` for provenance. Unknown-but-present
 * fields are collected under `extra` so no provider data is silently dropped.
 */

const str = (value: unknown): string =>
  value == null ? "" : String(value);

const first = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(str).filter(Boolean).join(", ");
  return str(value);
};

const nullableUrl = (value: unknown): string | null => {
  const s = str(value).trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  return s;
};

const nullableEmail = (value: unknown): string | null => {
  const s = str(value).trim().toLowerCase();
  if (!s) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return null;
  return s;
};

const pick = (obj: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

function pickNested(record: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = record;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    const next = (current as Record<string, unknown>)[segment];
    if (next === undefined || next === null) return undefined;
    current = next;
  }
  return current;
}

/** True when the value is a non-empty string, number, or a non-empty array. */
function isPresent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeLead(payload: Record<string, unknown>): RawLead {
  const organization =
    (payload.organization as Record<string, unknown> | undefined) ??
    (payload.employer as Record<string, unknown> | undefined) ??
    {};

  const firstName = first(pick(payload, ["firstName", "first_name", "givenName"]) ?? "");
  const lastName = first(pick(payload, ["lastName", "last_name", "familyName"]) ?? "");
  const fullName = first(pick(payload, ["name", "full_name", "displayName"]) ?? "");
  const [fallbackFirst, ...fallbackRest] = fullName.split(/\s+/);

  const email =
    nullableEmail(
      pick(payload, ["email", "personal_email", "work_email", "email_address"]) ??
        pickNested(organization, ["email"]) ??
        pick(payload, ["emails", "personal_emails"])?.toString(),
    ) ??
    (() => {
      const emails = pick(payload, ["emails", "personal_emails"]);
      if (Array.isArray(emails)) {
        for (const candidate of emails) {
          const parsed = nullableEmail(candidate);
          if (parsed) return parsed;
        }
      }
      return null;
    })();

  const phone =
    str(
      pick(payload, ["phone", "phone_number", "phone_numbers", "mobile_phone"]) ?? "",
    ) || first(pick(payload, ["phone_numbers"]) ?? "");

  const confidenceValue = pick(payload, ["confidence", "score", "match_score"]);
  const confidence =
    typeof confidenceValue === "number" && confidenceValue >= 0 && confidenceValue <= 1
      ? confidenceValue
      : undefined;

  const lead: RawLead = {
    firstName: firstName || fallbackFirst || "",
    lastName: lastName || fallbackRest.join(" ") || "",
    email,
    phone: phone.trim() ? phone.trim() : null,
    title: first(pick(payload, ["title", "job_title", "position", "role"]) ?? ""),
    seniority: first(pick(payload, ["seniority", "seniority_level"]) ?? ""),
    company: first(
      pick(payload, ["company", "company_name", "organization_name"]) ??
        pickNested(organization, ["name"]) ??
        "",
    ),
    industry: first(
      pick(payload, ["industry", "organization_industry"]) ??
        pickNested(organization, ["industry"]) ??
        "",
    ),
    companySize: first(
      pick(payload, ["company_size", "organization_num_employees"]) ??
        pickNested(organization, ["num_employees"]) ??
        "",
    ),
    location: first(
      pick(payload, ["location", "city_state", "person_location", "address"]) ??
        [pickNested(organization, ["city"]), pickNested(organization, ["state"]), pickNested(organization, ["country"])]
          .filter(isPresent)
          .join(", ") ??
        "",
    ),
    hqLocation: first(
      pick(payload, ["hq_location", "organization_location"]) ??
        [
          pickNested(organization, ["city"]),
          pickNested(organization, ["state"]),
          pickNested(organization, ["country"]),
        ]
          .filter(isPresent)
          .join(", ") ??
        "",
    ),
    linkedinUrl: nullableUrl(
      pick(payload, ["linkedin_url", "linkedinUrl", "linkedin_profile_url"]) ?? "",
    ),
    website: nullableUrl(
      pick(payload, ["website", "company_website", "organization_website"]) ??
        pickNested(organization, ["website"]) ??
        "",
    ),
    confidence,
    extra: {},
    raw: payload,
  };

  // Collect any fields not captured above so nothing is lost.
  const captured = new Set([
    "firstName",
    "first_name",
    "givenName",
    "lastName",
    "last_name",
    "familyName",
    "name",
    "full_name",
    "displayName",
    "email",
    "personal_email",
    "work_email",
    "email_address",
    "emails",
    "personal_emails",
    "phone",
    "phone_number",
    "phone_numbers",
    "mobile_phone",
    "title",
    "job_title",
    "position",
    "role",
    "seniority",
    "seniority_level",
    "company",
    "company_name",
    "organization_name",
    "organization",
    "employer",
    "industry",
    "organization_industry",
    "company_size",
    "organization_num_employees",
    "location",
    "city_state",
    "person_location",
    "address",
    "hq_location",
    "organization_location",
    "linkedin_url",
    "linkedinUrl",
    "linkedin_profile_url",
    "website",
    "company_website",
    "organization_website",
    "confidence",
    "score",
    "match_score",
  ]);
  for (const [key, value] of Object.entries(payload)) {
    if (!captured.has(key) && value !== undefined && value !== null) {
      lead.extra[key] = value;
    }
  }

  return lead;
}

/** Merge a newly enriched lead into an existing one, preferring non-empty values. */
export function mergeLead(base: RawLead, enriched: RawLead): RawLead {
  return {
    firstName: enriched.firstName || base.firstName,
    lastName: enriched.lastName || base.lastName,
    email: enriched.email ?? base.email,
    phone: enriched.phone ?? base.phone,
    title: enriched.title || base.title,
    seniority: enriched.seniority || base.seniority,
    company: enriched.company || base.company,
    industry: enriched.industry || base.industry,
    companySize: enriched.companySize || base.companySize,
    location: enriched.location || base.location,
    hqLocation: enriched.hqLocation || base.hqLocation,
    linkedinUrl: enriched.linkedinUrl ?? base.linkedinUrl,
    website: enriched.website ?? base.website,
    confidence: enriched.confidence ?? base.confidence,
    extra: { ...base.extra, ...enriched.extra },
    raw: { ...base.raw, ...enriched.raw },
  };
}