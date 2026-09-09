"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { z } from "zod";

import {
  CopilotChat,
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { createAgent } from "@/lib/api-client";

/**
 * Chat-powered agent creation. The user describes the agent they want to
 * build in a CopilotKit chatbox (the Agent Builder agent), the agent asks a
 * few clarifying questions, then calls the `createAgent` frontend tool.
 * On success the new agent is opened in the full editor (AgentConfigurator).
 */
export function CreateAgentWizard({
  onCreated,
  onDone,
}: {
  onCreated: (id: string) => void;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const { space } = useAppShell();

  const orgContext = useMemo(
    () => ({
      spaceId: space.spaceId ?? null,
      organizationId: space.organizationId ?? null,
      workspaceId: space.workspaceId ?? null,
      spaceName: space.name,
      kind: space.kind ?? "personal",
    }),
    [space.spaceId, space.organizationId, space.workspaceId, space.name, space.kind],
  );
  useAgentContext({
    description: "active Jamot workspace/organization the Agent Builder operates in",
    value: orgContext,
  });

  const ownerId = user?.actor?.id;

  useFrontendTool(
    {
      name: "createAgent",
      description:
        "Create a new Jamot agent with the given name, role/purpose and autonomy. Call this once the user has confirmed the agent they want to build.",
      parameters: z.object({
        name: z.string().describe("The agent's name"),
        role: z
          .string()
          .optional()
          .describe("The agent's role or purpose in one sentence"),
        autonomy: z
          .enum(["suggest", "approve", "autonomous"])
          .optional()
          .describe("How the agent acts: suggest, approve, or autonomous"),
        availability: z
          .enum(["available", "busy", "offline"])
          .optional()
          .describe("Initial availability (default: available)"),
      }),
      handler: async ({ name, role, autonomy, availability }) => {
        if (!ownerId) {
          throw new Error("You must be signed in to create an agent.");
        }
        const created = await createAgent({
          name,
          ownerId,
          role: role ?? null,
          organizationIds:
            space.kind === "organization" && space.organizationId
              ? [space.organizationId]
              : [],
          autonomy,
          availability,
        });
        onCreated(created.id);
        return {
          id: created.id,
          name: created.role ?? created.purpose ?? "Agent",
          role: created.role,
        };
      },
    },
    [ownerId, space.kind, space.organizationId, onCreated],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold">Add an agent</h3>
          <p className="truncate text-xs text-muted-foreground">
            Describe the agent you want — the Agent Builder will ask a few
            questions and create it for you.
          </p>
        </div>
        {onDone ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Close"
            onClick={onDone}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="h-[420px]">
        <CopilotChat
          agentId="builder"
          className="h-full"
          welcomeScreen={false}
          labels={{ chatInputPlaceholder: "Describe the agent you want to build…" }}
        />
      </div>
    </div>
  );
}