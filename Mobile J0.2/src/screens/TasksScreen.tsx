import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { useApp } from "../context/AppContext";
import { SubHeader } from "../components/SubHeader";
import type { Task } from "../types";

function statusLabel(status: Task["status"]): string {
  switch (status) {
    case "created":
    case "assigned":
      return "New";
    case "started":
      return "In progress";
    case "completed":
      return "Complete";
    case "cancelled":
      return "Declined";
  }
}

function chipColors(status: Task["status"]): { bg: string; fg: string } {
  if (status === "created" || status === "assigned") return { bg: "var(--color-accent)", fg: "#fff" };
  if (status === "completed") return { bg: "var(--color-surface)", fg: "var(--color-neutral-700)" };
  return { bg: "var(--color-accent-100)", fg: "var(--color-accent-700)" };
}

function whenLabel(task: Task): string {
  if (!task.dueDate) return "No due date";
  const due = new Date(task.dueDate);
  const today = new Date();
  const sameDay = due.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  return due.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function outcomeSummary(task: Task): string | null {
  const value = task.outcome?.summary;
  return typeof value === "string" && value.trim() ? value : null;
}

export function TasksScreen() {
  const { tasks, openTaskId, toggleTaskOpen, acceptTask, declineTask, completeTask } = useApp();
  const visible = tasks.filter((t) => t.status !== "cancelled");
  const newCount = tasks.filter((t) => t.status === "created" || t.status === "assigned").length;
  const activeCount = tasks.filter((t) => t.status === "started").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <SubHeader title="Tasks" right={`${newCount} new · ${activeCount} active`} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--color-neutral-600)" }}>
            Nothing assigned to you right now.
          </div>
        )}
        {visible.map((task) => {
          const open = openTaskId === task.id;
          const chip = chipColors(task.status);
          const isNew = task.status === "created" || task.status === "assigned";
          const isActive = task.status === "started";
          const outcome = outcomeSummary(task);
          return (
            <div
              key={task.id}
              onClick={() => toggleTaskOpen(task.id)}
              style={{ padding: 15, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: 11, fontWeight: 600 }}>
                  {statusLabel(task.status)}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-neutral-600)" }}>{whenLabel(task)}</span>
              </div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.25 }}>{task.title}</div>

              {open && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12, animation: "jm-fade .2s ease-out" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Why you</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{task.description || "No description on this task yet."}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Expected outcome</span>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{outcome ?? "No outcome set yet."}</span>
                  </div>

                  {isNew && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void acceptTask(task.id);
                        }}
                        style={actionBtn("var(--color-accent)", "#fff")}
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void declineTask(task.id);
                        }}
                        style={actionBtn("var(--color-surface)", "var(--color-text)")}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {isActive && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void completeTask(task.id);
                        }}
                        style={{ ...actionBtn("var(--color-accent)", "#fff"), flex: "none", padding: "0 18px", display: "flex", alignItems: "center", gap: 8 }}
                      >
                        <Check size={16} strokeWidth={2.4} />
                        Complete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function actionBtn(bg: string, color: string): CSSProperties {
  return {
    all: "unset",
    cursor: "pointer",
    flex: 1,
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--radius-sm)",
    background: bg,
    color,
    fontFamily: "var(--font-heading)",
    fontWeight: 800,
    fontSize: 14,
    boxSizing: "border-box",
  };
}
