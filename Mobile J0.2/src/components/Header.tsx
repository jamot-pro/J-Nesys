import { useApp } from "../context/AppContext";
import { displayName, initials } from "../lib/format";

export function Header() {
  const { person, availability, openProfile } = useApp();
  const name = displayName(person);

  return (
    <div
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 10,
        height: 52,
        padding: "0 14px",
        paddingTop: "env(safe-area-inset-top, 0px)",
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <img src="/jamot-logo.webp" alt="" width={24} height={24} style={{ flex: "none" }} />
      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14 }}>Jamot</span>
      <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>mini app</span>
      <button
        onClick={openProfile}
        title="Profile"
        style={{
          marginLeft: "auto",
          flex: "none",
          width: 32,
          height: 32,
          border: "none",
          borderRadius: 999,
          background: "var(--color-accent)",
          color: "#fff",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {initials(name)}
      </button>
      <span
        style={{
          flex: "none",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: availability.available ? "var(--color-accent)" : "var(--color-neutral-400)",
        }}
      />
    </div>
  );
}
