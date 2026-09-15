import { Database, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { SubHeader } from "../components/SubHeader";
import { ChipGroup } from "../components/ChipGroup";
import { displayName, initials } from "../lib/format";

const FIELD_DEFS: Array<{ key: "role" | "hours" | "taskLoad" | "channel"; label: string; placeholder: string }> = [
  { key: "role", label: "Role", placeholder: "e.g. Field sales" },
  { key: "hours", label: "Working hours", placeholder: "e.g. Mon–Fri 09:00–17:00" },
  { key: "taskLoad", label: "Task load", placeholder: "e.g. 4 visits per day" },
  { key: "channel", label: "Reach me on", placeholder: "e.g. Telegram, then phone" },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function ProfileScreen() {
  const {
    person,
    trustScore,
    availability,
    toggleAvailability,
    toggleRule,
    skills,
    languages,
    territory,
    addChip,
    removeChip,
    fields,
    updateFieldLocal,
    commitField,
    memories,
    removeMemory,
  } = useApp();

  const name = displayName(person);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <SubHeader title={name} right={availability.available ? "Available" : "Unavailable"} />
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              flex: "none",
              width: 52,
              height: 52,
              borderRadius: 999,
              background: "var(--color-accent)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            {initials(name)}
          </span>
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>{name}</span>
            <span style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{fields.role || "No role set"}</span>
          </span>
          {trustScore !== null && (
            <span style={{ marginLeft: "auto", textAlign: "right", display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, color: "var(--color-accent)" }}>{trustScore}</span>
              <span style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Trust</span>
            </span>
          )}
        </div>

        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Availability</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: availability.available ? "var(--color-accent)" : "var(--color-neutral-400)" }} />
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{availability.available ? "Available" : "Unavailable"}</span>
            <button
              onClick={() => void toggleAvailability()}
              style={{ all: "unset", cursor: "pointer", marginLeft: "auto", padding: "7px 14px", borderRadius: 999, background: "var(--color-surface)", fontSize: 12, fontWeight: 600 }}
            >
              {availability.available ? "Go off" : "Go on"}
            </button>
          </div>
          {availability.rules.map((r) => (
            <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={r.on} onChange={() => void toggleRule(r.id)} style={{ width: 18, height: 18, accentColor: "var(--color-accent)", cursor: "pointer" }} />
              <span style={{ lineHeight: 1.4 }}>{r.label}</span>
            </label>
          ))}
        </div>

        <ChipGroup label="Skills & capabilities" placeholder="Add skill" items={skills} onAdd={(v) => void addChip("skills", v)} onRemove={(v) => void removeChip("skills", v)} />
        <ChipGroup label="Languages" placeholder="Add language" items={languages} onAdd={(v) => void addChip("languages", v)} onRemove={(v) => void removeChip("languages", v)} />
        <ChipGroup label="Territory" placeholder="Add area" items={territory} onAdd={(v) => void addChip("territory", v)} onRemove={(v) => void removeChip("territory", v)} />

        <div style={{ padding: "4px 0 0", borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)" }}>
          {FIELD_DEFS.map((f, i) => (
            <div
              key={f.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderBottom: i < FIELD_DEFS.length - 1 ? "1px solid var(--color-divider)" : "none",
              }}
            >
              <span style={{ flex: "none", width: 96, fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>{f.label}</span>
              <input
                className="input"
                value={fields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => updateFieldLocal(f.key, e.target.value)}
                onBlur={() => commitField(f.key)}
                style={{ flex: 1, minWidth: 0, height: 34, borderRadius: "var(--radius-sm)", background: "var(--color-surface)", fontSize: 13 }}
              />
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>Personal memory</span>
          {memories.length === 0 && <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>Nothing remembered yet.</span>}
          {memories.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5 }}>
              <Database size={14} strokeWidth={1.9} style={{ flex: "none", marginTop: 3, opacity: 0.5 }} />
              <span style={{ flex: 1 }}>
                "{String(m.content.text ?? "")}"<span style={{ color: "var(--color-neutral-600)" }}> · {relativeTime(m.provenance.createdAt)}</span>
              </span>
              <button
                onClick={() => void removeMemory(m.id)}
                title="Forget"
                style={{ all: "unset", cursor: "pointer", flex: "none", color: "var(--color-neutral-600)", marginTop: 2 }}
              >
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
          ))}
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--color-neutral-600)", lineHeight: 1.5 }}>
            Jamot adds to this from what you tell it in Talk and from the tasks you complete.
          </p>
        </div>
      </div>
    </div>
  );
}
