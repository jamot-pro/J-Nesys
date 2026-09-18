"use client";

import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { useAppShell } from "@/components/app-shell/app-shell-context";
import {
  createLeadList,
  enrichLead,
  getLeadList,
  listLeadLists,
  listLeadListLeads,
  runLeadList,
} from "@/lib/api-client";

/**
 * Frontend tools for lead generation & enrichment. The server-side Main Manager
 * can call these to create research campaigns (Lead Lists), run them against a
 * configured provider (Apollo / Composio / MCP), and enrich collected leads.
 * The drawn map area + persona prefill is pushed to the agent context by the
 * Leads workspace; the agent merges it with natural language.
 */
export function useLeadTools(opts: {
  spaceId: string | null;
  organizationId: string | null;
}) {
  const { spaceId, organizationId } = opts;
  useFrontendTool(
    {
      name: "createLeadList",
      description:
        "Create a lead generation research campaign (a 'Lead List'). Use it when the user wants to find or generate leads for a target persona in a specific area. The persona and map area may be provided directly or come from the 'active lead research selection' context entry pushed by the Leads workspace. Name the list after the research (e.g. 'Paris CTO hunt'). Always run it with runLeadGeneration afterwards.",
      parameters: z.object({
        name: z.string().describe("Name for the Lead List, named after the research"),
        description: z.string().optional().describe("Optional description of the research"),
        persona: z
          .object({
            titles: z.array(z.string()).optional().describe("Job titles to target (e.g. CTO, VP Engineering)"),
            seniority: z.array(z.string()).optional().describe("Seniority levels (e.g. c_suite, vp, director)"),
            functions: z.array(z.string()).optional().describe("Functions/departments"),
            industries: z.array(z.string()).optional().describe("Industries to target (e.g. fintech, saas)"),
            companySizes: z.array(z.string()).optional().describe("Company size ranges (e.g. 11-50, 51-200)"),
            keywords: z.array(z.string()).optional().describe("Keywords appearing in profiles"),
            excludeEmails: z.array(z.string()).optional().describe("Emails to exclude"),
          })
          .optional()
          .describe("Target persona filters parsed from the user's request"),
        area: z
          .object({
            place: z.string().default("").describe("Human label for the area"),
            center: z.object({ lat: z.number(), lng: z.number() }).optional(),
            radiusKm: z.number().optional(),
            polygon: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
          })
          .optional()
          .describe("The geographic area drawn on the map. Prefer the 'active lead research selection' context area when the user says 'this area'"),
        providerId: z
          .string()
          .optional()
          .describe("Lead provider id: 'apollo', 'composio', or 'mcp'. Default 'apollo'."),
      }),
      handler: async ({ name, description, persona, area, providerId }) => {
        const list = await createLeadList({
          spaceId: spaceId ?? "",
          organizationId,
          name,
          description,
          persona: persona ?? undefined,
          area: area ?? null,
          providerId: providerId ?? "apollo",
        });
        return {
          id: list.id,
          name: list.name,
          providerId: list.providerId,
          status: list.status,
        };
      },
    },
    [spaceId, organizationId],
  );

  useFrontendTool(
    {
      name: "runLeadGeneration",
      description:
        "Run a Lead List against its configured provider to search and enrich leads, writing them into Jamot People under the list. Use after createLeadList or when the user asks to generate/refresh leads for a research.",
      parameters: z.object({
        listId: z.string().describe("The Lead List id to run"),
        limit: z.number().optional().describe("Maximum number of leads to collect (default 100)"),
      }),
      handler: async ({ listId, limit }) => {
        return runLeadList(listId, limit);
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "listLeadLists",
      description:
        "List the lead generation research campaigns (Lead Lists) for the active workspace.",
      parameters: z.object({}),
      handler: async () => {
        if (!spaceId) return [];
        return listLeadLists(spaceId, organizationId);
      },
    },
    [spaceId, organizationId],
  );

  useFrontendTool(
    {
      name: "getLeadList",
      description:
        "Get the details of a single Lead List including its persona, area, provider, and status.",
      parameters: z.object({
        listId: z.string().describe("The Lead List id"),
      }),
      handler: async ({ listId }) => {
        return getLeadList(listId);
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "getLeadListLeads",
      description:
        "List the collected leads (with firmographics: title, company, industry, email, LinkedIn) for a Lead List.",
      parameters: z.object({
        listId: z.string().describe("The Lead List id"),
      }),
      handler: async ({ listId }) => {
        const leads = await listLeadListLeads(listId);
        return leads.map((lead) => ({
          personId: lead.personId,
          name: lead.person?.displayName ?? null,
          email: lead.person?.email ?? null,
          title: lead.person?.title ?? "",
          seniority: lead.person?.seniority ?? "",
          company: lead.person?.company ?? "",
          industry: lead.person?.industry ?? "",
          companySize: lead.person?.companySize ?? "",
          location: lead.person?.location ?? "",
          linkedinUrl: lead.person?.linkedinUrl ?? null,
          status: lead.status,
        }));
      },
    },
    [],
  );

  useFrontendTool(
    {
      name: "enrichLead",
      description:
        "Enrich a single collected lead with additional firmographics (email, phone, LinkedIn, company details) using its provider.",
      parameters: z.object({
        listId: z.string().describe("The Lead List id the lead belongs to"),
        personId: z.string().describe("The person id of the lead to enrich"),
      }),
      handler: async ({ listId, personId }) => {
        const person = await enrichLead(listId, personId);
        return { personId: person.id, enriched: true };
      },
    },
    [],
  );
}

export function LeadToolBridge() {
  const { space } = useAppShell();
  useLeadTools({
    spaceId: space.spaceId ?? space.id,
    organizationId: space.organizationId ?? null,
  });
  return null;
}