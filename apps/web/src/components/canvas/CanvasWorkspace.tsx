"use client";

import { Fragment, useEffect, useState, type DragEvent } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Landmark,
  LayoutGrid,
  MessageCircle,
  Plus,
  Radar,
  Sparkles,
  Users,
  X,
  ListTodo,
  Bell,
  Check,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanvasPane, CanvasTile, AnyBlockKind } from "./canvas-types";
import { Palette, TileIcon, resolveTile } from "./palette";
import { useCanvasLayout, type MoveDirection } from "./use-canvas-layout";
import { listTasks } from "@/components/tasks/tasks-api";
import { useAppShell } from "@/components/app-shell/app-shell-context";

// ─── Live block icons ─────────────────────────────────────────────────────────
const LIVE_BLOCK_META: Partial<Record<string, { icon: LucideIcon; color: string; label: string }>> = {
  people:        { icon: Users,        color: "text-rose-400",  label: "People" },
  tasks:         { icon: ListTodo,     color: "text-amber-400", label: "Tasks" },
  agents:        { icon: Bot,          color: "text-violet-400", label: "Agents" },
  notifications: { icon: Bell,         color: "text-sky-400",   label: "Notifications" },
  whatsapp:      { icon: MessageCircle,color: "text-emerald-400", label: "WhatsApp" },
  activity:      { icon: Activity,     color: "text-orange-400", label: "Activity" },
  approvals:     { icon: Check,        color: "text-green-400", label: "Approvals" },
  finance:       { icon: Landmark,     color: "text-teal-400",  label: "Finance" },
  leads:         { icon: Radar,        color: "text-pink-400",  label: "Leads" },
  calendar:      { icon: CalendarDays, color: "text-indigo-400", label: "Calendar" },
};

// ─── Live data hooks ──────────────────────────────────────────────────────────
function useLiveMetric(tileId: string, spaceId: string | null): string {
  const [metric, setMetric] = useState("—");
  useEffect(() => {
    if (!spaceId) return;
    const kind = tileId;
    if (kind === "tasks") {
      listTasks(spaceId)
        .then((tasks) => {
          const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length;
          setMetric(
            overdue > 0
              ? `${tasks.length} tasks · ${overdue} overdue`
              : `${tasks.length} tasks`,
          );
        })
        .catch(() => setMetric("—"));
    } else {
      // For non-task live blocks, show a ready message
      const meta = LIVE_BLOCK_META[kind];
      setMetric(meta ? `${meta.label} connected` : "ready");
    }
  }, [tileId, spaceId]);
  return metric;
}

// ─── Dashboard event listeners (from CopilotKit actions) ─────────────────────
function useAddBlockEvent(onAdd: (blockType: string) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const blockType = (e as CustomEvent<{ blockType: string }>).detail.blockType;
      onAdd(blockType);
    };
    window.addEventListener("jamot:dashboard:addBlock", handler);
    return () => window.removeEventListener("jamot:dashboard:addBlock", handler);
  }, [onAdd]);
}

function useRemoveBlockEvent(onRemove: (blockType: string) => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const blockType = (e as CustomEvent<{ blockType: string }>).detail.blockType;
      onRemove(blockType);
    };
    window.addEventListener("jamot:dashboard:removeBlock", handler);
    return () => window.removeEventListener("jamot:dashboard:removeBlock", handler);
  }, [onRemove]);
}

// ─── Move capability ──────────────────────────────────────────────────────────
interface MoveCapability {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

function computeMoves(pane: CanvasPane, columnPanes: CanvasPane[]): MoveCapability {
  return {
    left: pane.position.column === 1,
    right: pane.position.column === 0,
    up: pane.position.order > 0,
    down: pane.position.order < columnPanes.length - 1,
  };
}

// ─── Move buttons ─────────────────────────────────────────────────────────────
function MoveButtons({
  canMove,
  onMove,
}: {
  canMove: MoveCapability;
  onMove: (direction: MoveDirection) => void;
}) {
  return (
    <div className="absolute right-1.5 top-1.5 z-10 hidden flex-col gap-0.5 group-hover:flex">
      <div className="flex gap-0.5">
        <button
          type="button"
          disabled={!canMove.up}
          onClick={() => onMove("up")}
          className="rounded border border-border/60 bg-background/80 p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-0 backdrop-blur"
          aria-label="Move up"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          disabled={!canMove.down}
          onClick={() => onMove("down")}
          className="rounded border border-border/60 bg-background/80 p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-0 backdrop-blur"
          aria-label="Move down"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
      <div className="flex gap-0.5">
        <button
          type="button"
          disabled={!canMove.left}
          onClick={() => onMove("left")}
          className="rounded border border-border/60 bg-background/80 p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-0 backdrop-blur"
          aria-label="Move left"
        >
          <ChevronLeft className="size-3" />
        </button>
        <button
          type="button"
          disabled={!canMove.right}
          onClick={() => onMove("right")}
          className="rounded border border-border/60 bg-background/80 p-0.5 text-muted-foreground transition hover:text-foreground disabled:opacity-0 backdrop-blur"
          aria-label="Move right"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Single dashboard tile/block card ─────────────────────────────────────────
function DashboardCard({
  pane,
  tile,
  canMove,
  spaceId,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  pane: CanvasPane;
  tile?: CanvasTile;
  canMove: MoveCapability;
  spaceId: string | null;
  onMove: (direction: MoveDirection) => void;
  onRemove: () => void;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (targetId: string) => void;
}) {
  const liveMetric = useLiveMetric(tile?.id ?? "", spaceId);
  const liveMeta = tile ? LIVE_BLOCK_META[tile.kind as string] ?? LIVE_BLOCK_META[tile.id] : null;
  const LiveIcon = liveMeta?.icon;

  return (
    <div
      className="group relative flex min-h-24 flex-col rounded-2xl border border-border/50 bg-card/80 p-4 shadow-xs backdrop-blur-sm transition-shadow hover:shadow-md"
      draggable
      onDragStart={() => tile && onDragStart(pane.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(pane.id)}
    >
      <MoveButtons canMove={canMove} onMove={onMove} />

      <button
        type="button"
        onClick={onRemove}
        className="absolute left-1.5 top-1.5 z-10 hidden rounded border border-border/60 bg-background/80 p-0.5 text-muted-foreground backdrop-blur transition hover:text-destructive group-hover:flex"
        aria-label="Remove block"
      >
        <X className="size-3" />
      </button>

      <div className="flex items-start gap-3">
        <div className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          liveMeta ? "bg-muted/50" : "bg-space-accent/10",
        )}>
          {LiveIcon ? (
            <LiveIcon className={cn("size-4", liveMeta?.color ?? "text-space-accent")} />
          ) : tile ? (
            <TileIcon tile={tile} className="size-4 text-space-accent" />
          ) : (
            <Sparkles className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{tile?.name ?? "Block"}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{liveMetric}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────
function DashboardColumn({
  panes,
  allPanes,
  tiles,
  columnIndex,
  spaceId,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  panes: CanvasPane[];
  allPanes: CanvasPane[];
  tiles: CanvasTile[];
  columnIndex: 0 | 1;
  spaceId: string | null;
  onMove: (paneId: string, direction: MoveDirection) => void;
  onRemove: (paneId: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (targetId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {panes.map((pane) => {
        const tile = tiles.find((t) => t.id === pane.tileId);
        const canMove = computeMoves(pane, panes);
        return (
          <DashboardCard
            key={pane.id}
            pane={pane}
            tile={tile}
            canMove={canMove}
            spaceId={spaceId}
            onMove={(dir) => onMove(pane.id, dir)}
            onRemove={() => onRemove(pane.id)}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        );
      })}
    </div>
  );
}

// ─── Add block button / picker ────────────────────────────────────────────────
const ADDABLE_LIVE_BLOCKS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "people",        label: "People",        icon: Users },
  { id: "tasks",         label: "Tasks",         icon: ListTodo },
  { id: "agents",        label: "Agents",        icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "whatsapp",      label: "WhatsApp",      icon: MessageCircle },
  { id: "activity",      label: "Activity",      icon: Activity },
  { id: "approvals",     label: "Approvals",     icon: Check },
  { id: "finance",       label: "Finance",       icon: Landmark },
  { id: "leads",         label: "Leads",         icon: Radar },
  { id: "calendar",      label: "Calendar",      icon: CalendarDays },
];

function AddBlockPicker({
  onAdd,
  onClose,
}: {
  onAdd: (id: string, label: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="glass-card glass-border absolute bottom-12 right-3 z-30 w-56 rounded-2xl p-2 shadow-xl">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground">Add block</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      {ADDABLE_LIVE_BLOCKS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => { onAdd(id, label); onClose(); }}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-muted"
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function CanvasWorkspace() {
  const { space } = useAppShell();
  const spaceId = space.spaceId ?? null;

  const {
    layout,
    tiles,
    movePane,
    removePane,
    addLiveTile,
    removeTileByKind,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = useCanvasLayout();

  const [showPicker, setShowPicker] = useState(false);

  // Listen for CopilotKit add/remove block events
  useAddBlockEvent((blockType) => {
    addLiveTile(blockType as AnyBlockKind);
  });
  useRemoveBlockEvent((blockType) => {
    removeTileByKind(blockType as AnyBlockKind);
  });

  const col0 = layout.panes
    .filter((p) => p.position.column === 0)
    .sort((a, b) => a.position.order - b.position.order);
  const col1 = layout.panes
    .filter((p) => p.position.column === 1)
    .sort((a, b) => a.position.order - b.position.order);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-space-accent" />
          <span className="text-sm font-semibold">Dashboard</span>
          <Badge variant="outline" className="text-[10px]">
            {layout.panes.length} blocks
          </Badge>
        </div>
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-xl"
            aria-label="Add block"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Plus className="size-4" />
          </Button>
          {showPicker ? (
            <AddBlockPicker
              onAdd={(id, label) => addLiveTile(id as AnyBlockKind, label)}
              onClose={() => setShowPicker(false)}
            />
          ) : null}
        </div>
      </header>

      {/* Empty state */}
      {layout.panes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-space-accent/10">
            <Sparkles className="size-6 text-space-accent" />
          </div>
          <p className="text-sm font-medium">Your dashboard is empty</p>
          <p className="max-w-48 text-xs text-muted-foreground">
            Add blocks to monitor your organization at a glance — or ask the AI to add them.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowPicker(true)}
          >
            <Plus className="size-3.5" />
            Add first block
          </Button>
        </div>
      ) : (
        /* 2-column grid */
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel id="col-0" defaultSize={50} minSize={20} className="overflow-y-auto">
            <DashboardColumn
              panes={col0}
              allPanes={layout.panes}
              tiles={tiles}
              columnIndex={0}
              spaceId={spaceId}
              onMove={movePane}
              onRemove={removePane}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </Panel>
          <Separator
            id="sep-dashboard"
            className="w-px bg-border/30 hover:bg-space-accent/40"
          />
          <Panel id="col-1" defaultSize={50} minSize={20} className="overflow-y-auto">
            <DashboardColumn
              panes={col1}
              allPanes={layout.panes}
              tiles={tiles}
              columnIndex={1}
              spaceId={spaceId}
              onMove={movePane}
              onRemove={removePane}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          </Panel>
        </Group>
      )}
    </div>
  );
}
