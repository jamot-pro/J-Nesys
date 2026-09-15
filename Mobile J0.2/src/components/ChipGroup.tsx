import { useState } from "react";
import { Plus, X } from "lucide-react";

export function ChipGroup({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };

  return (
    <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--color-bg)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((name) => (
          <button
            key={name}
            onClick={() => onRemove(name)}
            title="Remove"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 11px",
              borderRadius: 999,
              background: "var(--color-accent-100)",
              color: "var(--color-accent-700)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {name}
            <X size={10} strokeWidth={3} style={{ opacity: 0.55 }} />
          </button>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            placeholder={placeholder}
            style={{ height: 30, width: 120, borderRadius: 999, background: "var(--color-surface)", fontSize: 12 }}
          />
          <button
            onClick={commit}
            title="Add"
            style={{
              all: "unset",
              cursor: "pointer",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "var(--color-accent-100)",
              color: "var(--color-accent-700)",
            }}
          >
            <Plus size={14} strokeWidth={2.6} />
          </button>
        </span>
      </div>
    </div>
  );
}
