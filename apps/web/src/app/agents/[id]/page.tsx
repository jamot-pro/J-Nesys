"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { agentConsoleUrl } from "@/lib/agent-console-link";

/**
 * There is one place to configure an Agent now — the console, subdomain-
 * routed per organization — not a second copy of the editor living here.
 * This page resolves the agent's organization and hands off to it rather
 * than rendering its own config UI, so editing genuinely happens once.
 */
export default function AgentConfigPage() {
  const params = useParams<{ id: string }>();
  const agentId = params?.id;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;

    void (async () => {
      try {
        const url = await agentConsoleUrl(agentId);
        if (!cancelled) window.location.replace(url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not find that agent.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link
          href="/agents"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <BrandLogo className="size-5" />
        </Link>
        <span className="font-display text-sm font-semibold">Agent configuration</span>
      </header>

      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        {error ? (
          <>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Link href="/agents" className="text-sm font-medium text-space-accent hover:underline">
              Back to agents
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Taking you to this agent's configuration…</p>
        )}
      </div>
    </div>
  );
}
