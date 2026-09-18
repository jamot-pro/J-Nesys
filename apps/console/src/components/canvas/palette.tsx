"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarDays,
  Database,
  GripVertical,
  MessageCircle,
  MessageSquare,
  Network,
  Package,
  Plus,
  Send,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CanvasTile, CanvasTileKind } from "./canvas-types";

/**
 * Static catalog of tiles that can be placed on the canvas. Grouped by kind:
 * Apps, MCP, Harnesses, Channels.
 */
export const CANVAS_TILES: CanvasTile[] = [
  { id: "app-whatsapp", kind: "app", name: "WhatsApp", icon: "whatsapp", summary: "Customer messaging" },
  { id: "app-calendar", kind: "app", name: "Calendar", icon: "calendar", summary: "Schedules & bookings" },
  { id: "app-inventory", kind: "app", name: "Inventory", icon: "inventory", summary: "Stock & SKUs" },
  { id: "app-crm", kind: "app", name: "CRM", icon: "crm", summary: "Contacts & deals" },
  { id: "mcp-finance", kind: "mcp", name: "Finance MCP", icon: "finance", summary: "Ledger, invoices, tax" },
  { id: "mcp-crm", kind: "mcp", name: "CRM MCP", icon: "database", summary: "Pipeline data source" },
  { id: "harness-hermes", kind: "harness", name: "Hermes", icon: "hermes", summary: "Agent runtime" },
  { id: "harness-openclaw", kind: "harness", name: "OpenClaw", icon: "openclaw", summary: "Automation harness" },
  { id: "harness-openmanus", kind: "harness", name: "OpenManus", icon: "openmanus", summary: "Autonomous agent" },
  { id: "channel-whatsapp", kind: "channel", name: "WhatsApp", icon: "whatsapp", summary: "Messaging channel" },
  { id: "channel-matrix", kind: "channel", name: "Matrix", icon: "matrix", summary: "Federated chat" },
  { id: "channel-telegram", kind: "channel", name: "Telegram", icon: "telegram", summary: "Messaging channel" },
  { id: "channel-discord", kind: "channel", name: "Discord", icon: "discord", summary: "Community channel" },
];

export const TILE_ICONS: Record<string, LucideIcon> = {
  whatsapp: MessageCircle,
  calendar: CalendarDays,
  inventory: Package,
  crm: Users,
  finance: Wallet,
  database: Database,
  hermes: Bot,
  openclaw: Workflow,
  openmanus: Bot,
  matrix: Network,
  telegram: Send,
  discord: MessageSquare,
};

const KIND_LABELS: Record<CanvasTileKind, string> = {
  app: "Apps",
  mcp: "MCP",
  harness: "Harnesses",
  channel: "Channels",
};

const KIND_ORDER: CanvasTileKind[] = ["app", "mcp", "harness", "channel"];

export function resolveTile(id: string): CanvasTile | undefined {
  return CANVAS_TILES.find((tile) => tile.id === id);
}

/** Renders the lucide icon for a tile, if it has one. */
export function TileIcon({
  tile,
  className,
}: {
  tile: CanvasTile;
  className?: string;
}) {
  const Icon = tile.icon ? TILE_ICONS[tile.icon] : undefined;
  return Icon ? <Icon className={className} /> : null;
}

export interface PaletteProps {
  onAdd: (tile: CanvasTile) => void;
}

/**
 * Left-hand palette listing every available tile grouped by category. A tile
 * can be added to the canvas by clicking "+" or by dragging it onto the grid.
 */
export function Palette({ onAdd }: PaletteProps) {
  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        label: KIND_LABELS[kind],
        tiles: CANVAS_TILES.filter((tile) => tile.kind === kind),
      })),
    [],
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-sidebar px-2 py-3">
      <div>
        <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Palette
        </p>
        <p className="px-2 text-xs text-muted-foreground/70">
          Drag a tile onto the canvas, or click “+”.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.kind}>
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.tiles.map((tile) => (
              <PaletteItem key={tile.id} tile={tile} onAdd={onAdd} />
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}

function PaletteItem({
  tile,
  onAdd,
}: {
  tile: CanvasTile;
  onAdd: (tile: CanvasTile) => void;
}) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-jamot-tile", tile.id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex items-center gap-2 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted"
    >
      <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/40" />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        <TileIcon tile={tile} className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{tile.name}</span>
        {tile.summary ? (
          <span className="truncate text-xs text-muted-foreground">
            {tile.summary}
          </span>
        ) : null}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        aria-label={`Add ${tile.name}`}
        onClick={() => onAdd(tile)}
      >
        <Plus className="size-3.5" />
      </Button>
    </li>
  );
}
