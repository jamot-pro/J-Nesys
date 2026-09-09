"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { AgentConfigurator } from "@/components/agents/config/agent-configurator";

export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const agentId = params?.id;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link
          href="/agents"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <BrandLogo className="size-5" />
        </Link>
        <span className="font-display text-sm font-semibold">Agent configuration</span>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col">
        {agentId ? (
          <AgentConfigurator agentId={agentId} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No agent selected. Return to the directory.
            </p>
            <Link href="/agents" className="text-sm font-medium text-space-accent hover:underline">
              Back to agents
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}