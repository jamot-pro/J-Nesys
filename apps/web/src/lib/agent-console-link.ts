import { getAgent, getOrganizations } from "@/lib/api-client";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/**
 * There is one place to configure an Agent — the console, subdomain-routed
 * per organization — not a copy of the editor in the cockpit. Every surface
 * here that used to open an in-cockpit editor calls this instead.
 *
 * Resolves the agent's organization to build the console URL for it. Throws
 * a message meant to be shown to the user directly when resolution fails
 * (no organization, or the console domain isn't configured in this env).
 */
export async function agentConsoleUrl(agentId: string): Promise<string> {
  const [agent, organizations] = await Promise.all([getAgent(agentId), getOrganizations()]);
  const orgId = agent.organizationIds[0];
  const org = orgId ? organizations.find((o) => o.organization.id === orgId) : undefined;
  const slug = org?.organization.slug;

  if (!slug) throw new Error("This agent has no organization with a subdomain to configure it from.");
  if (!ROOT_DOMAIN) throw new Error("The console's domain is not configured here.");

  const target = new URL(`https://${slug}.${ROOT_DOMAIN}/`);
  target.searchParams.set("app", "agent-configurator");
  target.searchParams.set("agent", agentId);
  return target.toString();
}
