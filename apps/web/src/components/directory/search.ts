import type { AgentProfile } from "@/components/agents/agents-data";
import type { PersonProfile } from "@/components/people/people-data";

export type DirectoryKind = "people" | "agents";

export interface DirectoryMatch {
  kind: DirectoryKind;
  id: string;
  actorId?: string;
  name: string;
  role: string;
  score: number;
  snippet: string;
  matchedFields: string[];
}

interface WeightedField {
  label: string;
  weight: number;
  text: string;
}

interface SearchEntity {
  id: string;
  actorId?: string;
  name: string;
  role: string;
  fields: WeightedField[];
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKC").trim();
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 1) return 2;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const current = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
      previous = current;
    }
  }
  return row[n];
}

function scoreField(rawQuery: string, field: WeightedField): number {
  const queryTokens = tokenize(rawQuery);
  if (queryTokens.length === 0) return 0;

  const haystack = normalize(field.text);
  const hayTokens = tokenize(field.text);
  const full = normalize(rawQuery);

  let whole = 0;
  if (haystack === full) whole = field.weight;
  else if (haystack.startsWith(full)) whole = field.weight * 0.9;
  else if (haystack.includes(full)) whole = field.weight * 0.7;

  let tokens = 0;
  for (const queryToken of queryTokens) {
    let tokenBest = 0;
    for (const word of hayTokens) {
      let hit = 0;
      if (word === queryToken) hit = field.weight;
      else if (word.startsWith(queryToken)) hit = field.weight * 0.85;
      else if (word.includes(queryToken)) hit = field.weight * 0.6;
      else if (queryToken.length >= 4 && levenshtein(word, queryToken) === 1) {
        hit = field.weight * 0.45;
      }
      tokenBest = Math.max(tokenBest, hit);
    }
    if (hayTokens.length === 0 && haystack.includes(queryToken)) {
      tokenBest = field.weight * 0.6;
    }
    tokens += tokenBest;
  }

  return Math.max(whole, Math.min(tokens, field.weight * 2));
}

function buildSnippet(text: string, rawQuery: string): string {
  const lower = normalize(text);
  const marker = normalize(rawQuery);
  const matched = tokenize(rawQuery).find((token) => {
    const index = lower.indexOf(token);
    if (index === -1) return false;
    return lower
      .slice(index, index + token.length)
      .split(/\s+/)
      .some((part) => levenshtein(part, token) <= 1 || part.startsWith(token) || token.startsWith(part));
  }) ?? marker;

  const index = lower.indexOf(marker);
  if (index === -1 && matched !== marker) {
    return text.length > 140 ? `${text.slice(0, 140)}…` : text;
  }
  const at = index >= 0 ? index : 0;
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + matched.length + 60);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim() || text.slice(0, 140)}${suffix}`;
}

function scoreEntity(
  kind: DirectoryKind,
  rawQuery: string,
  entity: SearchEntity,
): DirectoryMatch | null {
  const matchedFields: string[] = [];
  let snippet = "";
  let total = 0;

  for (const field of entity.fields) {
    const contribution = scoreField(rawQuery, field);
    if (contribution <= 0) continue;
    total += contribution;
    if (contribution > 0 && matchedFields.length < 3) {
      matchedFields.push(field.label);
    }
    if (!snippet) {
      snippet = buildSnippet(field.text, rawQuery);
    }
  }

  if (total <= 0) return null;
  return {
    kind,
    id: entity.id,
    actorId: entity.actorId,
    name: entity.name,
    role: entity.role,
    score: total,
    snippet,
    matchedFields,
  };
}

function personFields(person: PersonProfile): WeightedField[] {
  const fields: WeightedField[] = [
    { label: "Name", weight: 10, text: person.name },
    { label: "Role", weight: 8, text: person.role },
    { label: "Department", weight: 5, text: person.identity.department },
    { label: "Location", weight: 6, text: person.identity.location },
    { label: "Timezone", weight: 4, text: person.identity.timezone },
    { label: "Availability", weight: 5, text: person.availability },
  ];
  if (person.identity.email) {
    fields.push({ label: "Email", weight: 3, text: person.identity.email });
  }
  if (person.identity.reportsTo) {
    fields.push({ label: "Reports to", weight: 4, text: person.identity.reportsTo });
  }
  for (const [label, attribute] of Object.entries(person.selfDescribed)) {
    fields.push({ label: `Self-described · ${label}`, weight: 5, text: attribute.value });
  }
  for (const [label, attribute] of Object.entries(person.integral)) {
    fields.push({ label: `Integral · ${label}`, weight: 5, text: attribute.value });
  }
  for (const skill of person.skills) {
    fields.push({ label: "Skill", weight: 7, text: skill });
  }
  for (const experience of person.experience) {
    fields.push({ label: "Experience", weight: 6, text: experience });
  }
  for (const [label, attribute] of Object.entries(person.preferences)) {
    fields.push({ label: `Preference · ${label}`, weight: 5, text: attribute.value });
  }
  for (const goal of person.goals) {
    fields.push({ label: "Goal", weight: 6, text: goal });
  }
  for (const contribution of person.contributions) {
    fields.push({ label: "Contribution", weight: 6, text: contribution });
  }
  for (const [capability, score] of Object.entries(person.reputation)) {
    fields.push({ label: `Reputation · ${capability}`, weight: 3, text: `${capability}: ${score}` });
  }
  for (const note of person.memory.notes) {
    fields.push({ label: "Memory", weight: 7, text: note });
  }
  return fields;
}

function agentFields(agent: AgentProfile): WeightedField[] {
  const fields: WeightedField[] = [
    { label: "Name", weight: 10, text: agent.name },
    { label: "Role", weight: 8, text: agent.role },
    { label: "Availability", weight: 5, text: agent.availability },
    { label: "Autonomy", weight: 5, text: `${agent.autonomy} autonomy` },
    { label: "Reports to", weight: 4, text: agent.reportsTo },
    { label: "Active tasks", weight: 3, text: `${agent.tasks.active} active tasks` },
  ];
  for (const skill of agent.skills) {
    fields.push({ label: "Skill", weight: 7, text: `${skill.name} ${skill.proficiency}` });
  }
  for (const channel of agent.channels) {
    fields.push({ label: "Channel", weight: 6, text: channel });
  }
  for (const [capability, score] of Object.entries(agent.reputation)) {
    fields.push({ label: `Reputation · ${capability}`, weight: 3, text: `${capability}: ${score}` });
  }
  for (const note of agent.memory.notes) {
    fields.push({ label: "Memory", weight: 7, text: note });
  }
  return fields;
}

export function searchDirectory(
  kind: DirectoryKind,
  query: string,
  people: PersonProfile[],
  agents: AgentProfile[],
): DirectoryMatch[] {
  const rawQuery = query.trim();
  if (!rawQuery) return [];

  const results: DirectoryMatch[] = [];
  const push = (entity: SearchEntity) => {
    const match = scoreEntity(kind, rawQuery, entity);
    if (match) results.push(match);
  };

  if (kind === "people") {
    for (const person of people) {
      push({
        id: person.id,
        actorId: person.actorId,
        name: person.name,
        role: person.role,
        fields: personFields(person),
      });
    }
  } else {
    for (const agent of agents) {
      push({
        id: agent.id,
        actorId: agent.actorId,
        name: agent.name,
        role: agent.role,
        fields: agentFields(agent),
      });
    }
  }

  return results.sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name),
  );
}

export function searchPeople(
  query: string,
  people: PersonProfile[],
): DirectoryMatch[] {
  return searchDirectory("people", query, people, []);
}

export function searchAgents(
  query: string,
  agents: AgentProfile[],
): DirectoryMatch[] {
  return searchDirectory("agents", query, [], agents);
}