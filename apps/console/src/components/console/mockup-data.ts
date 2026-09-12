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

/** One entry in the app rail. Populated from the organization's enabled apps,
 * not from a fixture — the mockup's own APPS list was removed once the rail
 * began reading enabledAppIds. */
export interface RailApp {
  id: string;
  title: string;
  icon: string;
  blurb: string;
}


/**
 * Catalog app id -> mockup icon key.
 *
 * The installable catalog and the mockup's rail were drawn from different
 * vocabularies: the catalog has `lead-generation` where the mockup has
 * `leadgen`, and carries apps the mockup never pictured. Anything unmapped
 * falls back to the generic document mark rather than rendering no icon.
 */
export const CATALOG_ICON: Record<string, string> = {
  crm: "crm",
  outreach: "outreach",
  "lead-generation": "leadgen",
  "event-management": "tasks",
  "supplier-catalog": "commerce",
  "supplier-network": "org",
  "restaurant-reservations": "tasks",
};

export function iconForCatalogApp(id: string): string {
  return ICONS[CATALOG_ICON[id] ?? ""] ?? ICONS.docs!;
}
