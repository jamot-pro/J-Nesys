"use client";

import { useState, type ReactNode } from "react";
import {
  Bot,
  ChevronDown,
  Database,
  ListChecks,
  MemoryStick,
  MessageSquare,
  Users,
} from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AUTONOMY_OPTIONS, type AgentProfile } from "./agents-data";

const AVAILABILITY: Record<AgentProfile["availability"], { label: string; dot: string }> = {
  available: { label: "Available", dot: "bg-emerald-500" },
  busy: { label: "Busy", dot: "bg-amber-500" },
  offline: { label: "Offline", dot: "bg-zinc-400" },
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tracking-tight">{value}</span>
    </div>
  );
}

export function AgentProfile({ agent }: { agent: AgentProfile }) {
  const availability = AVAILABILITY[agent.availability];
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [temperature, setTemperature] = useState("0.7");
  const [topP, setTopP] = useState("1.0");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a Jamot agent. Be calm, concise and respectful of the user's context.",
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-6">
      <header className="flex items-start gap-4">
        <Avatar name={agent.name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="accent" className="gap-1">
              <Bot className="size-3" />
              Agent
            </Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", availability.dot)} aria-hidden />
              {availability.label}
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {agent.name}
          </h1>
          <p className="text-sm text-muted-foreground">{agent.role}</p>
        </div>
      </header>

      <Section title="Skills">
        <div className="flex flex-col gap-3">
          {agent.skills.map((skill) => (
            <div key={skill.name} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm">{skill.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-space-accent"
                  style={{ width: `${skill.proficiency}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                {skill.proficiency}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Channels" icon={<MessageSquare className="size-4 text-muted-foreground" />}>
        <div className="flex flex-wrap gap-1.5">
          {agent.channels.map((channel) => (
            <Badge key={channel} variant="secondary">
              {channel}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Autonomy level">
        <div className="flex rounded-lg border border-border p-0.5">
          {AUTONOMY_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium",
                agent.autonomy === option.value
                  ? "bg-space-accent text-space-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              {option.label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reports to" icon={<Users className="size-4 text-muted-foreground" />}>
        <p className="text-sm">{agent.reportsTo}</p>
      </Section>

      <Section
        title="Memory"
        icon={<MemoryStick className="size-4 text-muted-foreground" />}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {agent.memory.interactions}
            </span>{" "}
            interactions on record
          </p>
          <ul className="flex flex-col gap-1.5">
            {agent.memory.notes.map((note) => (
              <li
                key={note}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                {note}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Stat label="Tasks · active" value={String(agent.tasks.active)} />

      <Section
        title="Reputation"
        icon={<Database className="size-4 text-muted-foreground" />}
      >
        <div className="flex flex-col gap-2">
          {Object.entries(agent.reputation).map(([capability, score]) => (
            <div key={capability} className="flex items-center justify-between gap-3">
              <span className="text-sm capitalize">
                {capability.replaceAll("_", " ")}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-space-accent"
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs text-muted-foreground">{score}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          className="flex w-full items-center gap-1.5 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", advancedOpen && "rotate-180")}
          />
          Advanced
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t border-border p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Temperature</span>
                <Input
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Top P</span>
                <Input value={topP} onChange={(event) => setTopP(event.target.value)} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">System prompt</span>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 text-xs text-muted-foreground">
        <ListChecks className="size-4" />
        Agent workspace — managed separately from People.
      </footer>
    </div>
  );
}
