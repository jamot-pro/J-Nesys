"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AtSign, Paperclip, Plus } from "lucide-react";

import {
  CopilotChat,
  useAgent,
  useAgentContext,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { CommerceToolBridge } from "@/components/commerce/use-commerce-tools";
import { LeadToolBridge } from "@/components/leads/LeadToolBridge";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { DREAM_CONFIG_EVENT } from "@/lib/dream-config";
import { DreamToolBridge } from "./DreamToolBridge";
import { MentionTextarea } from "./MentionTextarea";
import { UseCopilotUIActions } from "./use-copilot-ui-actions";

function Hint() {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 px-6 py-2.5 text-xs text-muted-foreground">
      <span className="glass-border inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 text-[11px] backdrop-blur-xs shadow-2xs">
        <Plus className="size-3 text-space-accent" />
        <Paperclip className="size-3 text-muted-foreground" />
        Attach
      </span>
      <span className="glass-border inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 text-[11px] backdrop-blur-xs shadow-2xs">
        <AtSign className="size-3 text-space-accent" />
        Person
      </span>
      <span className="glass-border inline-flex items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 text-[11px] backdrop-blur-xs shadow-2xs">
        <AtSign className="size-3 text-space-accent" />
        Agent
      </span>
    </div>
  );
}

function ChatContent() {
  const { space } = useAppShell();
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent");
  const orgContext = useMemo(
    () => ({
      spaceId: space.spaceId ?? null,
      organizationId: space.organizationId ?? null,
      workspaceId: space.workspaceId ?? null,
      spaceName: space.name,
      kind: space.kind ?? "personal",
      ...(agentId
        ? { agentId, agentMode: true as const, agentIdParam: agentId }
        : {}),
    }),
    [space.spaceId, space.organizationId, space.workspaceId, space.name, space.kind, agentId],
  );
  useAgentContext({
    description: "active Jamot workspace/organization the user is operating in",
    value: orgContext,
  });

  const { agent } = useAgent({});

  useEffect(() => {
    const onDreamConfig = (event: Event) => {
      const detail = (event as CustomEvent<{ objective?: string }>).detail;
      const objective = detail?.objective;
      const prompt = objective
        ? `Help me configure the DREAM for ${orgContext.spaceName}. Current objective: "${objective}". Let's refine the outcomes, KPIs, constraints and required responsibilities.`
        : `Help me configure the DREAM for ${orgContext.spaceName}: define the objective, measurable outcomes, KPIs, constraints, timeline, required capabilities and required responsibilities.`;
      agent.addMessage({
        id: `dream-${Date.now()}`,
        role: "user",
        content: prompt,
      });
      void agent.runAgent();
    };
    window.addEventListener(DREAM_CONFIG_EVENT, onDreamConfig);
    return () => window.removeEventListener(DREAM_CONFIG_EVENT, onDreamConfig);
  }, [agent, orgContext.spaceName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <UseCopilotUIActions />
      <CommerceToolBridge />
      <LeadToolBridge />
      <DreamToolBridge />
      <div className="min-h-0 flex-1 overflow-hidden">
        <CopilotChat
          className="h-full"
          welcomeScreen={false}
          input={{ textArea: MentionTextarea }}
          labels={{
            chatInputPlaceholder: agentId
              ? "Message the agent…"
              : "Message Jamot…",
          }}
        />
      </div>
      <Hint />
    </div>
  );
}

export function ChatWorkspace() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
