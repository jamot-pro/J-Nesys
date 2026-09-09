"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  HeartPulse,
  ListChecks,
  Settings2,
  Target,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { openDreamConfig } from "@/lib/dream-config";
import { KIND_ACCENT, KIND_LABEL } from "./org-data";
import type { OrgNode } from "@/lib/api-client";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: unknown[] }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={label}>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => {
          const text =
            typeof item === "string"
              ? item
              : typeof item === "object" && item !== null
                ? JSON.stringify(item)
                : String(item);
          return (
            <li key={`${label}-${index}`} className="flex items-start gap-2 text-sm">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">{text}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function stringList(config: Record<string, unknown>, key: string): string[] {
  const value = config[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function configString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === "string" ? value : null;
}

function configBool(config: Record<string, unknown>, key: string): boolean | null {
  const value = config[key];
  return typeof value === "boolean" ? value : null;
}

function renderGenericConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config).filter(
    ([, value]) =>
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value),
  );
  if (entries.length === 0) return null;
  return (
    <Section title="Config">
      <div className="flex flex-col gap-2">
        {entries.map(([key, value]) => (
          <Field
            key={key}
            label={key}
            value={
              Array.isArray(value)
                ? value.map(String).join(", ")
                : String(value)
            }
          />
        ))}
      </div>
    </Section>
  );
}

export function NodeDrawer({
  node,
  onClose,
}: {
  node: OrgNode;
  onClose: () => void;
}) {
  const config = node.config ?? {};

  const renderKind = () => {
    switch (node.kind) {
      case "dream": {
        const objective = configString(config, "objective");
        const outcomes = stringList(config, "outcomes");
        const constraints = stringList(config, "constraints");
        const requiredCapabilities = stringList(
          config,
          "requiredCapabilities",
        );
        return (
          <>
            <Section title="Objective">
              <p className="text-sm text-foreground">
                {objective ?? "No objective set yet."}
              </p>
            </Section>
            <ListField label="Outcomes" items={outcomes} />
            <ListField label="Constraints" items={constraints} />
            <ListField
              label="Required capabilities"
              items={requiredCapabilities}
            />
            {renderGenericConfig(config)}
          </>
        );
      }
      case "team": {
        const mission = configString(config, "mission");
        const kpis = stringList(config, "kpis");
        return (
          <>
            <Section title="Mission">
              <p className="text-sm text-foreground">
                {mission ?? "No mission set yet."}
              </p>
            </Section>
            <ListField label="KPIs" items={kpis} />
            {renderGenericConfig(config)}
          </>
        );
      }
      case "heartbeat": {
        const schedule = configString(config, "schedule");
        const monitors = stringList(config, "monitors");
        const actions = stringList(config, "actions");
        const enabled = configBool(config, "enabled");
        return (
          <>
            <Field label="Schedule" value={schedule ?? "Not configured"} />
            <div className="flex items-center gap-2 text-sm">
              <Activity
                className={
                  "size-4 shrink-0 " +
                  (enabled === false
                    ? "text-muted-foreground"
                    : "text-emerald-400")
                }
              />
              <span className="text-sm">
                {enabled === false ? "Disabled" : "Enabled"}
              </span>
            </div>
            <ListField label="Monitors" items={monitors} />
            <ListField label="Actions" items={actions} />
            {renderGenericConfig(config)}
          </>
        );
      }
      case "responsibility": {
        const owner = configString(config, "owner") ?? "Unassigned";
        return (
          <>
            <Section title="Owner status">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                {owner}
              </div>
            </Section>
            {renderGenericConfig(config)}
          </>
        );
      }
      case "tool":
        return (
          <>
            {renderGenericConfig(config)}
            {!renderGenericConfig(config) ? (
              <p className="text-sm text-muted-foreground">No config yet.</p>
            ) : null}
          </>
        );
      case "human":
      case "agent":
      default:
        return (
          <>
            {node.refId ? (
              <Field label="Reference" value={node.refId} />
            ) : null}
            {renderGenericConfig(config)}
            {!renderGenericConfig(config) ? (
              <p className="text-sm text-muted-foreground">No config yet.</p>
            ) : null}
          </>
        );
    }
  };

  return (
    <>
      <motion.div
        className="absolute inset-0 z-20 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-y-0 right-0 z-30 flex w-80 max-w-[85vw] flex-col border-l border-border bg-card"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.2 }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: KIND_ACCENT[node.kind] }}
              />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {KIND_LABEL[node.kind]}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold">{node.name}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {renderKind()}
        </div>

        <footer className="flex flex-col gap-2 border-t border-border p-4">
          {node.kind === "dream" ? (
            <Button className="w-full" onClick={() => openDreamConfig(configString(config, "objective") ?? undefined)}>
              <Target className="size-4" />
              Configure DREAM in chat
            </Button>
          ) : null}
          {node.kind === "agent" ? (
            <Button className="w-full">
              <Settings2 className="size-4" />
              Configure agent
            </Button>
          ) : null}
          {node.kind === "heartbeat" ? (
            <Button variant="outline" className="w-full">
              <HeartPulse className="size-4" />
              Heartbeat settings
            </Button>
          ) : null}
          {node.kind === "human" ? (
            <Button variant="outline" className="w-full">
              <User className="size-4" />
              Member profile
            </Button>
          ) : null}
        </footer>
      </motion.div>
    </>
  );
}