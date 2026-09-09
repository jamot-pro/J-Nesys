import type { Agent, Harness } from "@jamot/contracts";
import type { JamotRepository } from "../repository/repository.js";
import type { McpClient } from "./client.js";

export interface ImportExternalAgentDeps {
  repo: JamotRepository;
  client: McpClient;
  name: string;
  mcpUrl: string;
  ownerId: string;
  spaceId?: string;
}

function systemProvenance() {
  const now = new Date().toISOString();
  return { source: "system" as const, confidence: 1, createdAt: now, updatedAt: now };
}

export async function importExternalAgent(
  deps: ImportExternalAgentDeps,
): Promise<Agent> {
  const { repo, client, name, mcpUrl, ownerId, spaceId } = deps;

  const actor = await repo.createActor({
    type: "agent",
    source: "external",
    displayName: name,
    externalIdentities: [{ provider: "mcp", value: mcpUrl, verified: false }],
  });

  const skill = await repo.createSkill({
    ownerActorId: actor.id,
    ownerOrganizationId: null,
    name: `mcp.${name}`,
    description: `MCP tools exposed by external agent ${name}`,
    provenance: systemProvenance(),
  });

  const connector = await repo.createConnector({
    provider: "custom",
    type: "mcp",
    ownerActorId: actor.id,
    ownerOrganizationId: null,
    credentialRef: { ref: `mcp/${name}`, scope: "system" },
    configuration: { endpoint: mcpUrl },
  });

  const tools = await client.listTools();
  const capabilityIds: string[] = [];
  const capabilitySpaceId = spaceId ?? ownerId;
  for (const tool of tools) {
    const capability = await repo.createCapability({
      name: `mcp.${tool.name}`,
      skillId: skill.id,
      connectorId: connector.id,
      context: { tool: tool.name },
      spaceId: capabilitySpaceId,
    });
    capabilityIds.push(capability.id);
  }

  const harness: Harness = { kind: "mcp", endpoint: mcpUrl, config: {} };
  return repo.createAgent({
    actorId: actor.id,
    ownerId,
    organizationIds: spaceId ? [spaceId] : [],
    harness,
    skillIds: [skill.id],
    capabilityIds,
    availability: "available",
  });
}
