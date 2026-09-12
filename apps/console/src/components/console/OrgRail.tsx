"use client";

export interface RailOrg {
  id: string;
  name: string;
  initials: string;
  unread: number;
  /** True for the organization this console is serving. */
  active: boolean;
}

/** Org rail — a direct port of OrgConsole.dc.html's `org-rail` region
 * (lines 136–167), styles verbatim.
 *
 * The mockup ships five fixture orgs; this renders whatever the caller
 * passes. With a real session that is the organizations you actually belong
 * to, which is usually fewer.
 */
export function OrgRail({
  orgs,
  onPick,
  onOpenSwitcher,
}: {
  orgs: RailOrg[];
  onPick: (id: string) => void;
  onOpenSwitcher: () => void;
}) {
  return (
    <nav
      data-copilot-region="org-rail"
      style={{
        flex: "none",
        order: 3,
        width: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "var(--color-bg)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: "none",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          height: 52,
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "color-mix(in srgb, var(--color-text) 68%, transparent)",
          }}
        >
          Orgs
        </span>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 12, lineHeight: 1 }}>
          {orgs.length}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "var(--space-2) 0",
          overflowY: "auto",
        }}
      >
        {orgs.map((o) =>
          o.active ? (
            <div key={o.id} style={{ position: "relative", width: 44, height: 44, flex: "none" }}>
              <div
                title={o.name}
                style={{
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-accent)",
                  color: "#fff",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {o.initials}
              </div>
              <span
                style={{
                  position: "absolute",
                  top: "50%",
                  left: -7,
                  width: 3,
                  height: 22,
                  marginTop: -11,
                  borderRadius: 2,
                  background: "var(--color-text)",
                  pointerEvents: "none",
                }}
              />
            </div>
          ) : (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              title={o.name}
              style={{
                position: "relative",
                flex: "none",
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface)",
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: 14,
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              {o.initials}
              {o.unread ? (
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    right: 0,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--color-accent)",
                    color: "var(--color-bg)",
                    border: "2px solid var(--color-bg)",
                    borderRadius: 999,
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 9,
                    pointerEvents: "none",
                  }}
                >
                  {o.unread}
                </span>
              ) : null}
            </button>
          ),
        )}
      </div>

      <div
        style={{
          flex: "none",
          width: "100%",
          borderTop: "1px solid var(--color-divider)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          padding: "var(--space-2) 0",
        }}
      >
        <button
          onClick={onOpenSwitcher}
          title="All organizations"
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <button
          title="Create an organization"
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "1px dashed var(--color-divider)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
