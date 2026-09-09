"use client";

import { useState } from "react";
import { Check, Puzzle, Server, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AgentsWorkspace } from "@/components/agents/AgentsWorkspace";
import { PeopleWorkspace } from "@/components/people/PeopleWorkspace";
import { OrganizationWorkspace } from "@/components/organization/OrganizationWorkspace";
import { TasksBoard } from "@/components/tasks/TasksBoard";
import { CanvasWorkspace } from "@/components/canvas/CanvasWorkspace";
import { WhatsAppApp } from "@/components/whatsapp/WhatsAppApp";
import { FinanceWorkspace } from "@/components/finance/FinanceWorkspace";
import { SuppliersWorkspace } from "@/components/suppliers/SuppliersWorkspace";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";
import { OutreachWorkspace } from "@/components/outreach/OutreachWorkspace";

import { SECTION_TITLES, useAppShell, type SectionId } from "./app-shell-context";
import { SECTION_ITEMS } from "./AppRail";
import type { AppManifest } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const PLACEHOLDER_SECTIONS: SectionId[] = ["calendar", "crm"];

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
      {title} will appear here in a later phase.
    </div>
  );
}

function AddAppsSection() {
  const {
    railPrefs,
    toggleRailSection,
    availableApps,
    railAppIds,
    openApp,
    toggleRailApp,
    mcpRailItems,
    addMcpRailItem,
    removeMcpRailItem,
  } = useAppShell();
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");

  const addMcp = () => {
    addMcpRailItem(mcpName, mcpUrl);
    setMcpName("");
    setMcpUrl("");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Apps
        </h4>
        <div className="flex flex-col gap-0.5">
          {SECTION_ITEMS.map((item) => {
            const enabled = !railPrefs.hidden.includes(item.id);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleRailSection(item.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    enabled
                      ? "border-space-accent bg-space-accent text-space-accent-foreground"
                      : "border-border",
                  )}
                >
                  {enabled ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Launch apps
        </h4>
        <div className="flex flex-col gap-0.5">
          {availableApps.length === 0 ? (
            <p className="px-0.5 text-xs text-muted-foreground">No apps available.</p>
          ) : (
            availableApps.map((app) => {
              const enabled = railAppIds.includes(app.id);
              return (
                <div
                  key={app.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <Puzzle className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{app.name}</span>
                  <button
                    type="button"
                    onClick={() => openApp(app.id)}
                    className="rounded-md bg-space-accent/15 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-space-accent/25"
                  >
                    Open
                  </button>
                  <Switch
                    checked={enabled}
                    onChange={() => toggleRailApp(app.id)}
                    ariaLabel={`Pin ${app.name} to rail`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          MCP servers
        </h4>
        <div className="flex flex-col gap-0.5">
          {mcpRailItems.length === 0 ? (
            <p className="px-0.5 text-xs text-muted-foreground">
              No MCP servers added yet.
            </p>
          ) : (
            mcpRailItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <Server className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate" title={item.url}>
                  {item.label}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => removeMcpRailItem(item.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
          <div className="mt-1 flex flex-col gap-1">
            <Input
              placeholder="Name"
              value={mcpName}
              onChange={(event) => setMcpName(event.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex gap-1">
              <Input
                placeholder="https://…/mcp"
                value={mcpUrl}
                onChange={(event) => setMcpUrl(event.target.value)}
                className="h-8 flex-1 text-xs"
              />
              <Button variant="secondary" size="sm" onClick={addMcp}>
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-tight text-muted-foreground">
        Added MCP servers appear in the rail and open the Agents section.
      </p>
    </div>
  );
}

function AppPanelBody({ app }: { app: AppManifest }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">{app.description}</p>
      {app.capabilities.length > 0 ? (
        <div>
          <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Capabilities
          </h4>
          <div className="flex flex-wrap gap-1">
            {app.capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="text-xs text-muted-foreground">Version {app.version}</div>
    </div>
  );
}

export function AppDock() {
  const {
    activeSection,
    activeAppId,
    availableApps,
    setActiveSection,
    closeApp,
  } = useAppShell();

  if (!activeSection && !activeAppId) {
    return null;
  }

  if (activeAppId) {
    const app = availableApps.find((candidate) => candidate.id === activeAppId);
    return (
      <aside className="flex h-full flex-col bg-sidebar/80 text-sidebar-foreground backdrop-blur-md">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {app?.name ?? "App"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Close app"
            onClick={closeApp}
          >
            <X className="size-3.5" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {app ? (
            <AppPanelBody app={app} />
          ) : (
            <p className="p-4 text-xs text-muted-foreground">App not found.</p>
          )}
        </div>
      </aside>
    );
  }

  if (!activeSection) {
    return null;
  }

  let content;
  switch (activeSection) {
    case "tasks":
      content = <TasksBoard />;
      break;
    case "people":
      content = <PeopleWorkspace />;
      break;
    case "agents":
      content = <AgentsWorkspace />;
      break;
    case "organization":
      content = <OrganizationWorkspace />;
      break;
    case "dashboard":
      content = <CanvasWorkspace />;
      break;
    case "whatsapp":
      content = <WhatsAppApp compact />;
      break;
    case "suppliers":
      content = <SuppliersWorkspace />;
      break;
    case "leads":
      content = <LeadsWorkspace />;
      break;
    case "outreach":
      content = <OutreachWorkspace />;
      break;
    case "finance":
      content = <FinanceWorkspace />;
      break;
    case "add-apps":
      content = <AddAppsSection />;
      break;
    default:
      content = PLACEHOLDER_SECTIONS.includes(activeSection) ? (
        <PlaceholderSection title={SECTION_TITLES[activeSection]} />
      ) : null;
  }

  return (
    <aside className="flex h-full flex-col bg-sidebar/80 backdrop-blur-md text-sidebar-foreground">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {SECTION_TITLES[activeSection]}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Close section"
          onClick={() => setActiveSection(null)}
        >
          <X className="size-3.5" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{content}</div>
    </aside>
  );
}
