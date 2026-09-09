import type { Agent } from "@jamot/contracts";
import { cronMatches } from "./cron.js";

export const DEFAULT_HEARTBEAT_ACTIONS = [
  "reflect",
  "inspect",
  "propose",
  "escalate",
] as const;

function inQuietHours(window: string, now: Date): boolean {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(window);
  if (!match) return false;
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4]);
  if (
    startHour > 23 ||
    startMinute > 59 ||
    endHour > 23 ||
    endMinute > 59
  ) {
    return false;
  }
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function isHeartbeatDue(
  heartbeat: Agent["heartbeat"],
  now: Date,
): boolean {
  if (heartbeat.enabled !== true) return false;
  if (heartbeat.cron && !cronMatches(heartbeat.cron, now)) return false;
  if (heartbeat.quietHours && inQuietHours(heartbeat.quietHours, now)) {
    return false;
  }
  return true;
}
