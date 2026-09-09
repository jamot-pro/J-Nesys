"use client";

import { useMemo } from "react";
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
  Landmark,
  LayoutGrid,
  ListTodo,
  Megaphone,
  MessageCircle,
  Plus,
  Radar,
  Server,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

import { useAppShell, type SectionId } from "./app-shell-context";

interface RailItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
}

export const SECTION_ITEMS: RailItem[] = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "people", label: "People", icon: Users },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "crm", label: "CRM", icon: Briefcase },
  { id: "leads", label: "Leads", icon: Radar },
  { id: "outreach", label: "Outreach", icon: Megaphone },
  { id: "finance", label: "Finance", icon: Landmark },
];

const railButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-foreground transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]";

/** Narrow icon-only app rail — mirrors OrgConsole.dc.html's `app-rail`
 * region: a home button, the user's ordered/draggable app icons, then a
 * bottom utility cluster (add apps, settings, theme). */
export function AppRail() {
  const { activeSection, activeAppId, setActiveSection, railPrefs, mcpRailItems, reorderRailSections } =
    useAppShell();

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
          title="Dashboard"
          aria-label="Dashboard"
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
        <Link href="/settings" title="Settings" aria-label="Settings" className={railButtonClass}>
          <Settings className="size-5" />
        </Link>
        <ThemeToggle />
      </div>
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
      <Icon className="size-5 opacity-85" />
    </button>
  );
}
