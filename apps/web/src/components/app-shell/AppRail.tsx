"use client";

import { useMemo } from "react";
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
  Maximize2,
  Megaphone,
  MessageCircle,
  Plus,
  Radar,
  Server,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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

interface AppRailProps {
  expanded?: boolean;
  onRestoreChat?: () => void;
  onSelectSection?: (id: SectionId) => void;
  onOpenAddApps?: () => void;
}

export function AppRail({
  expanded = false,
  onRestoreChat,
  onSelectSection,
  onOpenAddApps,
}: AppRailProps) {
  const {
    activeSection,
    setActiveSection,
    railPrefs,
    mcpRailItems,
    reorderRailSections,
  } = useAppShell();

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

  const selectSection = (id: SectionId) => {
    if (onSelectSection) onSelectSection(id);
    else setActiveSection(id);
  };

  const renderItem = (item: RailItem) => {
    const active = activeSection === item.id;
    return (
      <SortableRailItem
        key={item.id}
        item={item}
        active={active}
        expanded={expanded}
        onClick={() =>
          onSelectSection
            ? onSelectSection(item.id)
            : setActiveSection(active ? null : item.id)
        }
      />
    );
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-l border-border/40 bg-sidebar/80 py-2 text-sidebar-foreground backdrop-blur-md transition-[width] duration-200",
        expanded
          ? "w-full items-stretch gap-0.5"
          : "w-14 items-center gap-1",
      )}
    >
      {expanded ? (
        <div className="mb-1 flex shrink-0 items-center justify-between border-b border-border px-3 pb-2">
          <span className="font-display text-sm font-semibold tracking-tight">
            Apps
          </span>
          {onRestoreChat ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              aria-label="Restore full layout"
              title="Restore full layout"
              onClick={onRestoreChat}
            >
              <Maximize2 className="size-3.5" />
              Expand
            </Button>
          ) : null}
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={railPrefs.order}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={cn(
              "flex flex-col gap-1",
              expanded ? "w-full px-2" : "items-center",
            )}
          >
            {visibleItems.map(renderItem)}
          </div>
        </SortableContext>
      </DndContext>

      <div className={cn("my-1 h-px bg-border/40", expanded ? "mx-3" : "w-6")} />

      {mcpRailItems.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          className={cn(
            expanded ? "h-9 w-full justify-start gap-2 px-3 text-sm" : "size-9 rounded-lg",
            activeSection === "agents" && "bg-muted text-foreground",
          )}
          aria-label={`${item.label} (MCP)`}
          title={`${item.label} — MCP server`}
          onClick={() => selectSection("agents")}
        >
          <Server className="size-4 shrink-0 text-muted-foreground" />
          {expanded ? (
            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          ) : null}
        </Button>
      ))}

      <div className="mt-auto" />

      <Button
        variant="ghost"
        className={cn(
          "shrink-0",
          expanded ? "h-9 w-full justify-start gap-2 px-3 text-sm" : "size-9 rounded-lg",
        )}
        aria-label="Add or manage apps"
        title="Add apps"
        onClick={() => {
          onOpenAddApps?.();
          setActiveSection("add-apps");
        }}
      >
        <Plus className="size-4 shrink-0" />
        {expanded ? <span>Add apps</span> : null}
      </Button>
    </div>
  );
}

function SortableRailItem({
  item,
  active,
  expanded,
  onClick,
}: {
  item: RailItem;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const Icon = item.icon;

  return (
    <Button
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      variant="ghost"
      className={cn(
        expanded ? "h-9 w-full justify-start gap-2 px-3 text-sm" : "size-9 rounded-lg",
        active && "bg-muted text-foreground",
        isDragging && "opacity-60",
      )}
      aria-label={item.label}
      aria-pressed={active}
      title={`${item.label} — drag to reorder`}
      onClick={onClick}
    >
      <Icon
        className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")}
      />
      {expanded ? (
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      ) : null}
    </Button>
  );
}
