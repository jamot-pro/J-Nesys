"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SettingsSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  body: ReactNode;
}

export interface SettingsGroup {
  title: string;
  sections: SettingsSection[];
}

export function SettingsLayout({ groups }: { groups: SettingsGroup[] }) {
  const [activeId, setActiveId] = useState<string>(
    groups[0]?.sections[0]?.id ?? "",
  );

  const allSections = groups.flatMap((group) => group.sections);
  const active = allSections.find((section) => section.id === activeId);

  return (
    <div className="flex h-full min-h-0">
      <nav className="flex w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-sidebar px-3 py-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.sections.map((section) => {
                const Icon = section.icon;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(section.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        activeId === section.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {Icon ? <Icon className="size-4" /> : null}
                      {section.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl">
          {active ? active.body : null}
        </div>
      </main>
    </div>
  );
}
