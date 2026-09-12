/**
 * Fixtures copied verbatim from templates/org-console/OrgConsole.dc.html.
 *
 * These are the mockup's own values. Anything here is placeholder content
 * standing in for a backend that does not exist yet — per the brief, the
 * mockup stays as-is until the corresponding API is wired. Replace an entry
 * with live data only when there is a real endpoint behind it; do not edit
 * these to look "more real".
 */

/** Lucide-style path data, keyed as in the mockup's ICONS map. */
export const ICONS: Record<string, string> = {
  profile: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  crm: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  tasks: "M9 11l3 3L21 5M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  sales: "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  org: "M9 2h6v6H9zM2 16h6v6H2zM16 16h6v6h-6zM12 8v4M5 16v-4h14v4",
  channels: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  memory:
    "M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5",
  analytics: "M3 3v18h18M7 15v3M12 9v9M17 5v13",
  docs: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4",
  outreach: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  leadgen: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M11 8v6M8 11h6",
  dream: "M12 3l2.2 5.6L20 10l-4.4 3.4L16.8 19 12 16.2 7.2 19l1.2-5.6L4 10l5.8-1.4z",
  ronbot: "M9 2v3M15 2v3M5 8h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM9 13v2M15 13v2",
  commerce: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  mydreams: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z",
  agents: "M12 2v3M8 5h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9.5 9h.01M14.5 9h.01M7 17h10M5 21h14",
};

export interface RailApp {
  id: string;
  title: string;
  icon: string;
  blurb: string;
}

export const APPS: RailApp[] = [
  { id: "mydreams", title: "My Dreams", icon: "mydreams", blurb: "Every dream you have joined, the agents you maintain there, and what you have earned." },
  { id: "crm", title: "People", icon: "crm", blurb: "Every human your agents can act for or reach out to." },
  { id: "tasks", title: "Task Manager", icon: "tasks", blurb: "Work items assigned to humans and agents alike." },
  { id: "channels", title: "Channels", icon: "channels", blurb: "Inbound and outbound conversations in one place." },
  { id: "memory", title: "Knowledge", icon: "memory", blurb: "Browse and curate what the organization knows." },
  { id: "analytics", title: "Analytics", icon: "analytics", blurb: "Usage, cost and agent performance over time." },
  { id: "docs", title: "Documents", icon: "docs", blurb: "Files the platform reads, writes and versions." },
  { id: "outreach", title: "Outreach", icon: "outreach", blurb: "Agents work a People list through a cascade of messages." },
  { id: "leadgen", title: "Lead Generation", icon: "leadgen", blurb: "Agents find new leads against a target and write them into People." },
  { id: "dream", title: "Dream Chart", icon: "dream", blurb: "The dream, the orchestrator, and every actor working toward it." },
  { id: "commerce", title: "Commerce", icon: "commerce", blurb: "Agents buy from and sell to other companies over MCP, inside a budget you set." },
  { id: "agents", title: "Agent Configurator", icon: "agents", blurb: "Give an agent a purpose, skills, tools, a model and an effort — then watch its score evolve." },
  { id: "ronbot", title: "Ronbot", icon: "ronbot", blurb: "Order a Jamot-powered robot that runs on company memory." },
];

export interface MockOrg {
  id: string;
  name: string;
  role: string;
  people: string;
  agents: string;
  unread: number;
}

export const ORGS: MockOrg[] = [
  { id: "northbound", name: "Northbound Collective", role: "Super admin", people: "34", agents: "61", unread: 0 },
  { id: "tidal", name: "Tidal Grid", role: "Super admin", people: "12", agents: "14", unread: 3 },
  { id: "harbor", name: "Harbor & Fen", role: "Admin", people: "8", agents: "5", unread: 0 },
  { id: "lumen", name: "Lumen Schools", role: "Member", people: "46", agents: "22", unread: 7 },
  { id: "fairledger", name: "Fair Ledger", role: "Admin", people: "19", agents: "12", unread: 0 },
];

/** The mockup derives rail initials from the org name. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
