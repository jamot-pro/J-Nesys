"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

import type { AnyBlockKind, CanvasLayout, CanvasPane, CanvasTile } from "./canvas-types";

const STORAGE_KEY = "jamot.canvas.layout";
const EMPTY: CanvasLayout = { panes: [] };

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isPane(value: unknown): value is CanvasPane {
  if (!value || typeof value !== "object") return false;
  const pane = value as Record<string, unknown>;
  const position = pane.position as Record<string, unknown> | null;
  return (
    typeof pane.id === "string" &&
    typeof pane.tileId === "string" &&
    typeof position === "object" &&
    position !== null &&
    typeof position.column === "number" &&
    typeof position.order === "number"
  );
}

/**
 * Clamp each pane's position and re-number `order` per column so it stays
 * contiguous (0..n-1). Panes are re-ordered by column first, then by order.
 */
function normalize(panes: CanvasPane[]): CanvasPane[] {
  const buckets = new Map<0 | 1, CanvasPane[]>();
  for (const pane of panes) {
    const column: 0 | 1 = pane.position.column === 1 ? 1 : 0;
    const list = buckets.get(column) ?? [];
    list.push(pane);
    buckets.set(column, list);
  }

  const result: CanvasPane[] = [];
  for (const column of [0, 1] as const) {
    const list = (buckets.get(column) ?? []).sort(
      (a, b) => a.position.order - b.position.order,
    );
    list.forEach((pane, order) => {
      result.push({ ...pane, position: { column, order } });
    });
  }
  return result;
}

function parse(raw: string | null): CanvasLayout {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as { panes?: unknown };
    if (!parsed || !Array.isArray(parsed.panes)) return EMPTY;
    return { panes: normalize(parsed.panes.filter(isPane)) };
  } catch {
    return EMPTY;
  }
}

/* ------------------------------------------------------------------ */
/* localStorage as an external store (hydration-safe, no setState-in-  */
/* effect). The parsed layout is cached so getSnapshot stays stable    */
/* across renders unless the persisted value actually changed.         */
/* ------------------------------------------------------------------ */

let cachedRaw: string | null = null;
let cachedLayout: CanvasLayout = EMPTY;
const listeners = new Set<() => void>();

function getSnapshot(): CanvasLayout {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedLayout;
  cachedRaw = raw;
  cachedLayout = parse(raw);
  return cachedLayout;
}

function getServerSnapshot(): CanvasLayout {
  return EMPTY;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Shared tile registry (live blocks + legacy canvas tiles) */
let tileRegistry: CanvasTile[] = [];

function getTiles(): CanvasTile[] {
  return tileRegistry;
}

function write(layout: CanvasLayout): void {
  const normalized = { panes: normalize(layout.panes) };
  const raw = JSON.stringify(normalized);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
  cachedRaw = raw;
  cachedLayout = normalized;
  listeners.forEach((listener) => listener());
}

export type MoveDirection = "up" | "down" | "left" | "right";

export interface UseCanvasLayout {
  layout: CanvasLayout;
  tiles: CanvasTile[];
  load: () => CanvasLayout;
  save: (layout: CanvasLayout) => void;
  addPane: (tile: CanvasTile) => void;
  addLiveTile: (kind: AnyBlockKind, label?: string) => void;
  removeTileByKind: (kind: AnyBlockKind) => void;
  removePane: (paneId: string) => void;
  movePane: (paneId: string, direction: MoveDirection) => void;
  /** Persist vertical sizes (percentages) for every pane in a column. */
  applyColumnSizes: (column: 0 | 1, sizes: Record<string, number>) => void;
  handleDragStart: (paneId: string) => void;
  handleDragOver: (event: React.DragEvent) => void;
  handleDrop: (targetPaneId: string) => void;
}

// React DragEvent type (import inline)
type ReactDragEvent = React.DragEvent<Element>;

export function useCanvasLayout(): UseCanvasLayout {
  const layout = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const dragSourceRef = useRef<string | null>(null);

  const load = useCallback(() => getSnapshot(), []);

  const save = useCallback((next: CanvasLayout) => {
    write(next);
  }, []);

  const addPane = useCallback((tile: CanvasTile) => {
    // Register tile globally
    if (!tileRegistry.some((t) => t.id === tile.id)) {
      tileRegistry = [...tileRegistry, tile];
    }
    const prev = getSnapshot();
    const left = prev.panes.filter((p) => p.position.column === 0).length;
    const right = prev.panes.filter((p) => p.position.column === 1).length;
    const column: 0 | 1 = left <= right ? 0 : 1;
    const order = column === 0 ? left : right;
    const pane: CanvasPane = {
      id: createId(),
      tileId: tile.id,
      position: { column, order },
    };
    write({ panes: normalize([...prev.panes, pane]) });
  }, []);

  /**
   * Add a live intelligence block (people, tasks, agents, etc.) by kind.
   * Creates a synthetic tile and pane for it.
   */
  const addLiveTile = useCallback((kind: AnyBlockKind, label?: string) => {
    const id = kind as string;
    const name = label ?? (id.charAt(0).toUpperCase() + id.slice(1));
    const tile: CanvasTile = { id, kind, name };
    // Avoid duplicates
    const prev = getSnapshot();
    if (prev.panes.some((p) => p.tileId === id)) return;
    addPane(tile);
  }, [addPane]);

  /**
   * Remove all panes for a given tile kind.
   */
  const removeTileByKind = useCallback((kind: AnyBlockKind) => {
    const id = kind as string;
    const prev = getSnapshot();
    write({
      panes: normalize(prev.panes.filter((p) => p.tileId !== id)),
    });
  }, []);

  const removePane = useCallback((paneId: string) => {
    const prev = getSnapshot();
    write({
      panes: normalize(prev.panes.filter((pane) => pane.id !== paneId)),
    });
  }, []);

  const movePane = useCallback(
    (paneId: string, direction: MoveDirection) => {
      const prev = getSnapshot();
      const panes = prev.panes.map((pane) => ({
        ...pane,
        position: { ...pane.position },
      }));
      const pane = panes.find((candidate) => candidate.id === paneId);
      if (!pane) return;

      const { column } = pane.position;

      if (direction === "left" || direction === "right") {
        const target: 0 | 1 = direction === "left" ? 0 : 1;
        if (column === target) return;
        pane.position = { column: target, order: Number.MAX_SAFE_INTEGER };
        write({ panes: normalize(panes) });
        return;
      }

      const columnPanes = panes
        .filter((candidate) => candidate.position.column === column)
        .sort((a, b) => a.position.order - b.position.order);
      const index = columnPanes.findIndex((candidate) => candidate.id === paneId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= columnPanes.length) return;

      const swapTarget = columnPanes[targetIndex];
      const order = pane.position.order;
      pane.position.order = swapTarget.position.order;
      swapTarget.position.order = order;
      write({ panes: normalize(panes) });
    },
    [],
  );

  const applyColumnSizes = useCallback(
    (column: 0 | 1, sizes: Record<string, number>) => {
      const prev = getSnapshot();
      write({
        panes: prev.panes.map((pane) => {
          if (pane.position.column !== column) return pane;
          const size = sizes[pane.id];
          if (typeof size !== "number" || !Number.isFinite(size)) return pane;
          return { ...pane, size: Math.min(100, Math.max(1, Math.round(size))) };
        }),
      });
    },
    [],
  );

  const handleDragStart = useCallback((paneId: string) => {
    dragSourceRef.current = paneId;
  }, []);

  const handleDragOver = useCallback((event: ReactDragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((targetPaneId: string) => {
    const sourceId = dragSourceRef.current;
    dragSourceRef.current = null;
    if (!sourceId || sourceId === targetPaneId) return;
    const prev = getSnapshot();
    const source = prev.panes.find((p) => p.id === sourceId);
    const target = prev.panes.find((p) => p.id === targetPaneId);
    if (!source || !target) return;
    const panes = prev.panes.map((p) => {
      if (p.id === sourceId) return { ...p, position: { ...target.position } };
      if (p.id === targetPaneId) return { ...p, position: { ...source.position } };
      return p;
    });
    write({ panes: normalize(panes) });
  }, []);

  return {
    layout,
    tiles: getTiles(),
    load,
    save,
    addPane,
    addLiveTile,
    removeTileByKind,
    removePane,
    movePane,
    applyColumnSizes,
    handleDragStart,
    handleDragOver,
    handleDrop,
  };
}
