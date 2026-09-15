import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "../context/AppContext";

export function SubHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { goHome } = useApp();
  return (
    <div
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <button
        onClick={goHome}
        title="Back"
        style={{
          all: "unset",
          cursor: "pointer",
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-surface)",
        }}
      >
        <ChevronLeft size={17} strokeWidth={2.2} />
      </button>
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>{title}</span>
      {right && (
        <span style={{ marginLeft: "auto", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-neutral-600)" }}>
          {right}
        </span>
      )}
    </div>
  );
}
