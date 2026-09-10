"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  LayoutGrid,
  MessageCircle,
  Plus,
  Server,
  Settings,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { WalletModal } from "@/components/discover/WalletModal";
import { SystemConfigModal } from "@/components/discover/SystemConfigModal";

import { useAppShell, type SectionId } from "./app-shell-context";

interface RailItem {
  id: SectionId;
  label: string;
  icon: LucideIcon | null;
  /** SVG path `d` copied verbatim from OrgConsole.dc.html's ICONS map, used
   * instead of `icon` whenever this section has an exact mockup source. */
  d?: string;
}

/** ICONS map from OrgConsole.dc.html, copied verbatim (24x24 viewBox,
 * stroke-based). Only entries with a real counterpart in this app's section
 * list are used below — sections the mockup doesn't model (Agents,
 * Dashboard, WhatsApp, Calendar, Suppliers, generic CRM) keep a lucide icon
 * instead of an invented path. */
const MOCK_ICON_D = {
  mydreams: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z",
  crm: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  tasks: "M9 11l3 3L21 5M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  channels: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  org: "M9 2h6v6H9zM2 16h6v6H2zM16 16h6v6h-6zM12 8v4M5 16v-4h14v4",
  outreach: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  leadgen: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3M11 8v6M8 11h6",
  commerce: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
} as const;

function MockIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85 }}
    >
      <path d={d} />
    </svg>
  );
}

export const SECTION_ITEMS: RailItem[] = [
  { id: "my-dreams", label: "My Dreams", icon: null, d: MOCK_ICON_D.mydreams },
  { id: "people", label: "People", icon: null, d: MOCK_ICON_D.crm },
  { id: "tasks", label: "Task Manager", icon: null, d: MOCK_ICON_D.tasks },
  { id: "channels", label: "Channels", icon: null, d: MOCK_ICON_D.channels },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "organization", label: "Organization", icon: null, d: MOCK_ICON_D.org },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "crm", label: "CRM", icon: Briefcase },
  { id: "leads", label: "Leads", icon: null, d: MOCK_ICON_D.leadgen },
  { id: "outreach", label: "Outreach", icon: null, d: MOCK_ICON_D.outreach },
  { id: "finance", label: "Finance", icon: null, d: MOCK_ICON_D.commerce },
];

const railButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]";

/** Narrow icon-only app rail — mirrors OrgConsole.dc.html's `app-rail`
 * region: a home button, the user's ordered/draggable app icons, then a
 * bottom utility cluster (add apps, settings, theme). */
export function AppRail() {
  const { activeSection, activeAppId, setActiveSection, railPrefs, mcpRailItems, reorderRailSections } =
    useAppShell();
  const [walletOpen, setWalletOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visibleItems = useMemo<RailItem[]>(
    () =>
      railPrefs.order
        .filter((id) => !railPrefs.hidden.includes(id))
        .map((id) => SECTION_ITEMS.find((item) => item.id === id))
        .filter((item): item is RailItem => Boolean(item)),
    [railPrefs],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = railPrefs.order.indexOf(active.id as SectionId);
    const to = railPrefs.order.indexOf(over.id as SectionId);
    if (from === -1 || to === -1) return;
    reorderRailSections(from, to);
  };

  return (
    <nav className="flex h-full w-[60px] shrink-0 flex-col items-center overflow-hidden rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-sm)]">
      <div className="flex h-[52px] w-full shrink-0 items-center justify-center border-b border-border">
        <button
          type="button"
          title="Discover dreams"
          aria-label="Discover dreams"
          onClick={() => setActiveSection(null)}
          className={railButtonClass}
        >
          <BrandLogo className="size-6" />
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={railPrefs.order} strategy={verticalListSortingStrategy}>
          <div className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto py-2">
            {visibleItems.map((item) => (
              <SortableRailItem
                key={item.id}
                item={item}
                active={!activeAppId && activeSection === item.id}
                onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
              />
            ))}
            {mcpRailItems.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`${item.label} — MCP server`}
                aria-label={item.label}
                onClick={() => setActiveSection("agents")}
                className={cn(railButtonClass, activeSection === "agents" && "bg-muted")}
              >
                <Server className="size-4.5 opacity-85" />
              </button>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex w-full shrink-0 flex-col items-center gap-1 border-t border-border py-2">
        <button
          type="button"
          title="Add apps"
          aria-label="Add apps"
          onClick={() => setActiveSection("add-apps")}
          className={cn(railButtonClass, activeSection === "add-apps" && "bg-muted")}
        >
          <Plus className="size-5" />
        </button>
        <button
          type="button"
          title="Wallet"
          aria-label="Wallet"
          onClick={() => setWalletOpen(true)}
          className={railButtonClass}
        >
          <MockIcon d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M16 14h2" />
        </button>
        <button
          type="button"
          title="System configuration"
          aria-label="System configuration"
          onClick={() => setConfigOpen(true)}
          className={railButtonClass}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="9" cy="6" r="2.4" fill="var(--card)" />
            <circle cx="15" cy="12" r="2.4" fill="var(--card)" />
            <circle cx="8" cy="18" r="2.4" fill="var(--card)" />
          </svg>
        </button>
        <Link href="/settings" title="Settings" aria-label="Settings" className={railButtonClass}>
          <Settings className="size-5" />
        </Link>
        <ThemeToggle />
      </div>

      {walletOpen ? <WalletModal onClose={() => setWalletOpen(false)} /> : null}
      {configOpen ? <SystemConfigModal onClose={() => setConfigOpen(false)} /> : null}
    </nav>
  );
}

function SortableRailItem({
  item,
  active,
  onClick,
}: {
  item: RailItem;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const Icon = item.icon;

  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      type="button"
      title={`${item.label} — drag to reorder`}
      aria-label={item.label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        railButtonClass,
        "cursor-grab active:cursor-grabbing",
        active && "bg-[color-mix(in_srgb,var(--foreground)_12%,transparent)]",
        isDragging && "opacity-60",
      )}
    >
      {item.d ? <MockIcon d={item.d} /> : Icon ? <Icon className="size-5 opacity-85" /> : null}
    </button>
  );
}
