import { ChevronRight, ClipboardCheck, MessageSquare } from "lucide-react";
import { useApp } from "../context/AppContext";
import { AvailabilityTrack } from "../components/AvailabilityTrack";
import { displayName } from "../lib/format";

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

export function HomeScreen() {
  const { person, tasks, availability, goTalk, goTasks, openProfile } = useApp();
  const newCount = tasks.filter((t) => t.status === "created" || t.status === "assigned").length;
  const activeCount = tasks.filter((t) => t.status === "started").length;
  const name = displayName(person);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 16px 18px", minHeight: 0 }}>
      <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
        {todayLabel()}
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 34,
          lineHeight: 1.05,
          letterSpacing: "-.02em",
        }}
      >
        {greeting()}
        <br />
        {name}
      </div>
      <div style={{ flex: 1, minHeight: 14 }} />

      <button
        onClick={goTalk}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 116,
          padding: "0 22px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-accent)",
          color: "#fff",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <MessageSquare size={30} strokeWidth={1.9} />
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, letterSpacing: ".02em" }}>Talk</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>Tell Jamot what's happening</span>
        </span>
      </button>

      <button
        onClick={goTasks}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 116,
          marginTop: 12,
          padding: "0 22px",
          borderRadius: "var(--radius-md)",
          background: "var(--color-bg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <ClipboardCheck size={30} strokeWidth={1.9} style={{ opacity: 0.75 }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, letterSpacing: ".02em" }}>Tasks</span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {newCount} new · {activeCount} active
          </span>
        </span>
        {newCount > 0 && (
          <span
            style={{
              marginLeft: "auto",
              minWidth: 24,
              height: 24,
              padding: "0 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {newCount}
          </span>
        )}
      </button>

      <div style={{ marginTop: 22, padding: 16, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <button
            onClick={openProfile}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: availability.available ? "var(--color-accent)" : "var(--color-neutral-400)",
                display: "inline-block",
              }}
            />
            {availability.available ? "Available" : "Unavailable"}
            <ChevronRight size={14} strokeWidth={2.4} style={{ opacity: 0.4 }} />
          </button>
          <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
            {availability.available ? "Swipe left to go off" : "Swipe right to go on"}
          </span>
        </div>
        <AvailabilityTrack />
      </div>
    </div>
  );
}
