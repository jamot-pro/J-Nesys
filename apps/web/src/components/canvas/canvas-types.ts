/**
 * Shared types for the Company Dashboard (formerly "Canvas").
 *
 * Block kinds cover both app-connector tiles and live-data intelligence blocks.
 */

/** App-connector tile kinds (existing) */
export type CanvasTileKind = "app" | "mcp" | "harness" | "channel";

/** Live dashboard block kinds */
export type DashboardBlockKind =
  | "people"
  | "tasks"
  | "agents"
  | "notifications"
  | "whatsapp"
  | "activity"
  | "approvals"
  | "finance"
  | "leads"
  | "calendar";

/** Union of all block types renderable in the Dashboard */
export type AnyBlockKind = CanvasTileKind | DashboardBlockKind;

export interface CanvasTile {
  id: string;
  kind: AnyBlockKind;
  name: string;
  /** Icon key resolved to a lucide-react icon by the UI layer. */
  icon?: string;
  summary?: string;
}

/** Position of a pane inside the 2-column grid. */
export interface CanvasPosition {
  /** 0 = left column, 1 = right column. */
  column: 0 | 1;
  /** 0-based vertical order within the column. */
  order: number;
}

export interface CanvasPane {
  id: string;
  tileId: string;
  position: CanvasPosition;
  /** Vertical size within its column, as a percentage (0..100). */
  size?: number;
}

export interface CanvasLayout {
  panes: CanvasPane[];
}
