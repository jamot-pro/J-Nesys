import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DashboardSummary, Id } from "@jamot/contracts";
import type { JamotRepository } from "../repository.js";
import { actorRoleInSpace, requireAuth } from "../rbac.js";
import { fail, parse } from "../util.js";

function requireSpaceMember(repo: JamotRepository) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    spaceId: string,
  ): Promise<boolean> => {
    const actorId = request.session.actorId;
    if (!actorId) {
      fail(reply, 401, "Unauthenticated");
      return false;
    }
    const role = await actorRoleInSpace(repo, actorId, spaceId as Id);
    if (!role) {
      fail(reply, 403, "No access to this space");
      return false;
    }
    return true;
  };
}

/**
 * The console homepage's one read: everything the dashboard tiles need,
 * computed here rather than assembled client-side from five list endpoints.
 * Every number is a live count over real rows — nothing here is sampled,
 * cached, or invented; a quiet space legitimately shows zeros.
 */
export default async function dashboardRoutes(
  app: FastifyInstance,
  opts: { repository: JamotRepository },
): Promise<void> {
  const { repository: repo } = opts;
  const canAccessSpace = requireSpaceMember(repo);

  app.get("/dashboard/summary", { preHandler: requireAuth }, async (request, reply) => {
    const query = request.query as { spaceId?: string; organizationId?: string };
    const spaceId = parse(Id, request.resolvedSpaceId ?? query.spaceId, reply);
    if (!spaceId) return;
    if (!(await canAccessSpace(request, reply, spaceId))) return;
    const organizationId = query.organizationId ? parse(Id, query.organizationId, reply) : undefined;
    if (query.organizationId && !organizationId) return;

    const [leadLists, deals, agents, campaigns] = await Promise.all([
      repo.listLeadLists({ spaceId }),
      repo.listDeals({ spaceId }),
      repo.listAgents(organizationId ? { organizationId } : undefined),
      repo.listOutreachCampaigns({ spaceId }),
    ]);

    /* Members live under each list rather than the space, so counting leads
       across a space means visiting every list — the same shape LeadGen and
       Outreach already use for their own totals. */
    const memberLists = await Promise.all(
      leadLists.map((list) => repo.listLeadListMembers(list.id)),
    );
    const members = memberLists.flat();
    const leadsEnriched = members.filter((m) => Boolean(m.raw?.enrichedAt)).length;
    /* "Hot" has no field of its own: a qualified lead — vetted, not yet
       converted — is the closest honest reading of the term. */
    const hotLeads = members.filter((m) => m.status === "qualified").length;

    const dealsOpen = deals.filter((d) => d.stage === "open").length;
    const dealsWon = deals.filter((d) => d.stage === "won").length;
    const dealsLost = deals.filter((d) => d.stage === "lost").length;

    const revenueByCurrencyMap = new Map<string, number>();
    for (const deal of deals) {
      if (deal.stage !== "won") continue;
      revenueByCurrencyMap.set(
        deal.currency,
        (revenueByCurrencyMap.get(deal.currency) ?? 0) + deal.valueAmount,
      );
    }

    const sendLists = await Promise.all(
      campaigns.map((c) => repo.listOutreachSends({ campaignId: c.id })),
    );
    const outreachSent = sendLists.flat().length;
    const outreachCampaignsActive = campaigns.filter((c) => c.status === "active").length;

    const recentDeals = [...deals]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8);

    return DashboardSummary.parse({
      spaceId,
      leadsGenerated: members.length,
      leadsEnriched,
      hotLeads,
      salesPeople: agents.length,
      dealsOpen,
      dealsWon,
      dealsLost,
      revenueByCurrency: [...revenueByCurrencyMap.entries()].map(([currency, amount]) => ({
        currency,
        amount,
      })),
      outreachCampaignsActive,
      outreachSent,
      recentDeals,
      generatedAt: new Date().toISOString(),
    });
  });
}
