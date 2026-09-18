"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { OrgAppsList } from "@/components/settings/org-apps-list";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { OrgTelegramSection } from "@/components/settings/org-telegram-section";
import { OrgMembersSection } from "@/components/settings/org-members-section";
import { WorkspacesSection } from "@/components/settings/workspaces-section";
import { resolveLogoUrl } from "@/components/settings/use-org-branding";
import { useAuth } from "@/components/auth/auth-context";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import {
  createOrganization,
  deleteOrganization,
  getOrganizations,
  type OrganizationListItem,
  type OrgRole,
} from "@/lib/api-client";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

// Shared visual language with the org console (ConsoleRoot/Dashboard/AppRail):
// design-system.css tokens via inline style, Archivo headings, soft cards.
// hq is not itself an organization, so it gets this shell rather than the
// mono-org OrgConsole — but the look must match, not the old shadcn admin UI.
const UPPER: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const CARD: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg)",
  boxShadow: "var(--shadow-sm)",
  padding: "var(--space-4)",
};

const MUTED = "color-mix(in srgb, var(--color-text) 76%, transparent)";

const ROLE_TONE: Record<NonNullable<OrgRole>, string> = {
  owner: "var(--color-accent)",
  admin: "oklch(0.55 0.14 250)",
  member: MUTED,
  agent: MUTED,
  external: MUTED,
};

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      style={{
        ...UPPER,
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 999,
        color: tone,
        background: "color-mix(in srgb, currentColor 14%, transparent)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "none",
        color: danger ? "oklch(0.5 0.16 30)" : "var(--color-text)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function PillButton({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "solid" | "outline" | "ghost";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: "var(--radius-sm)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
    border: "1px solid transparent",
  };
  const style: React.CSSProperties =
    variant === "solid"
      ? { ...base, background: "var(--color-accent)", color: "#fff" }
      : variant === "outline"
        ? { ...base, background: "none", border: "1px solid var(--color-divider)", color: "var(--color-text)" }
        : { ...base, background: "none", color: "var(--color-text)" };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        padding: "9px 11px",
        fontSize: 14,
        ...props.style,
      }}
    />
  );
}

type Tab = "settings" | "telegram" | "members" | "workspaces" | "apps";

export default function AdminPage() {
  const { user } = useAuth();
  const { setSpace, reloadOrganizations } = useAppShell();
  const router = useRouter();

  const [items, setItems] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [dream, setDream] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("settings");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const selected = items.find((i) => i.organization.id === selectedId) ?? null;

  // hq has no organization of its own — the console body normally carries
  // per-org branding via html style (lib/brand.ts); this page sets the
  // Modernist theme's dark/light attribute the same way ConsoleRoot does.
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.body.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getOrganizations();
      setItems(next);
      await reloadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getOrganizations()
      .then((items) => {
        if (!cancelled) setItems(items);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load organizations");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createOrg = async () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createOrganization({
        name: trimmed,
        dream: dream.trim() || undefined,
        slug: slug.trim() || undefined,
      });
      setName("");
      setDream("");
      setSlug("");
      await reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create organization");
    } finally {
      setCreating(false);
    }
  };

  const openOrg = (org: OrganizationListItem) => {
    const firstWorkspace = org.workspaces?.[0] ?? { spaceId: org.space.id };
    setSpace(firstWorkspace.spaceId);
    router.push("/");
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId || deleting) return;
    const org = items.find((i) => i.organization.id === confirmDeleteId);
    if (!org) return;
    if (confirmName !== org.space.name) {
      setError("The name you typed does not match the organization name");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteOrganization(confirmDeleteId, confirmName);
      setConfirmDeleteId(null);
      setConfirmName("");
      if (selectedId === confirmDeleteId) setSelectedId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete organization");
    } finally {
      setDeleting(false);
    }
  };

  if (!user?.isSuperAdmin) {
    return (
      <div
        style={{
          display: "flex",
          height: "100dvh",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface)",
          color: "var(--color-text)",
        }}
      >
        <div style={{ ...CARD, maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <ShieldAlert size={28} color={MUTED} />
          <h1 style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
            Access denied
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Only super admins can view this console.</p>
          <PillButton onClick={() => router.push("/")}>Back to home</PillButton>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        height: "100dvh",
        width: "100%",
        padding: 12,
        overflow: "hidden",
        background: "var(--color-surface)",
        color: "var(--color-text)",
      }}
    >
      {/* Rail — same chrome as the org console's AppRail, minimal since hq has
          exactly one surface today (Organizations) plus the theme toggle. */}
      <nav
        style={{
          flex: "none",
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
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <button
            onClick={() => router.push("/")}
            title="Back to jamot-console home"
            style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark-light" src="/brand/jamot-logo.webp" alt="Jamot" width={26} height={26} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="mark-dark" src="/brand/jamot-logo-white.webp" alt="Jamot" width={26} height={26} />
          </button>
        </div>
        <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "var(--space-2) 0" }}>
          <div style={{ position: "relative", width: 44, height: 44 }}>
            <button
              title="Organizations"
              style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "color-mix(in srgb, var(--color-text) 12%, transparent)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-text)",
              }}
            >
              <Building2 size={20} strokeWidth={2} style={{ opacity: 0.85 }} />
            </button>
          </div>
        </div>
        <div style={{ flex: "none", width: "100%", borderTop: "1px solid var(--color-divider)", display: "flex", justifyContent: "center", padding: "var(--space-2) 0" }}>
          <IconButton title="Theme" onClick={() => setDark((v) => !v)}>
            <span style={{ fontSize: 16 }}>{dark ? "☀" : "☾"}</span>
          </IconButton>
        </div>
      </nav>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: 52,
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
          <button
            onClick={() => router.push("/")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13 }}
          >
            <ArrowLeft size={16} />
            Home
          </button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-6)" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-6)" }}>
              <Sparkles size={24} color="var(--color-accent)" />
              <div>
                <span style={UPPER}>HQ</span>
                <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, letterSpacing: "-0.01em" }}>
                  Organizations
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: MUTED }}>
                  Create and configure every organization&rsquo;s console — subdomain, logo, Telegram Mini App and more.
                </p>
              </div>
            </div>

            <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: "var(--space-6)" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ ...UPPER, fontSize: 10, display: "block", marginBottom: 6 }}>Name</label>
                <TextInput placeholder="New organization name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ ...UPPER, fontSize: 10, display: "block", marginBottom: 6 }}>Subdomain</label>
                <TextInput placeholder="organization" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
              </div>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={{ ...UPPER, fontSize: 10, display: "block", marginBottom: 6 }}>Dream</label>
                <TextInput
                  placeholder="Optional long-term vision"
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createOrg();
                  }}
                />
              </div>
              <PillButton onClick={() => void createOrg()} disabled={creating}>
                {creating ? <Loader2 className="animate-spin" size={14} /> : <Building2 size={14} />}
                Create
              </PillButton>
            </div>

            {createError ? <p style={{ color: "oklch(0.5 0.16 30)", fontSize: 13, marginBottom: 12 }}>{createError}</p> : null}
            {error ? <p style={{ color: "oklch(0.5 0.16 30)", fontSize: 13, marginBottom: 12 }}>{error}</p> : null}

            {selected ? (
              <ManagePanel
                item={selected}
                tab={tab}
                setTab={setTab}
                onClose={() => {
                  setSelectedId(null);
                  void reload();
                }}
                onChanged={() => void reload()}
              />
            ) : loading ? (
              <p style={{ fontSize: 14, color: MUTED }}>Loading organizations…</p>
            ) : items.length === 0 ? (
              <div style={CARD}>
                <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No organizations yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((item) => (
                  <div key={item.organization.id} style={{ ...CARD, padding: "var(--space-3) var(--space-4)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                      {item.organization.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveLogoUrl(item.organization.logoUrl) ?? ""}
                          alt={item.space.name}
                          style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-divider)", objectFit: "contain", flex: "none" }}
                        />
                      ) : (
                        <Building2 size={36} color={MUTED} style={{ flex: "none" }} />
                      )}

                      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.space.name}
                        </span>
                        <span style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.organization.slug && ROOT_DOMAIN
                            ? `${item.organization.slug}.${ROOT_DOMAIN}`
                            : item.organization.dream || "No subdomain or dream set"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: MUTED }}>
                        <span>{item.workspaces.length} workspace(s)</span>
                        <span>{item.organization.enabledAppIds.length} apps</span>
                        {item.role ? <Badge tone={ROLE_TONE[item.role]}>{item.role}</Badge> : null}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <PillButton
                          variant="outline"
                          onClick={() => {
                            setSelectedId(item.organization.id);
                            setTab("settings");
                          }}
                        >
                          Manage
                        </PillButton>
                        <PillButton onClick={() => openOrg(item)}>Open</PillButton>
                        <IconButton danger title={`Delete ${item.space.name}`} onClick={() => setConfirmDeleteId(item.organization.id)}>
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {confirmDeleteId ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 24 }}>
          <div style={{ ...CARD, width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>Delete organization</h2>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmName("");
                }}
                style={{ background: "none", border: "none", color: MUTED, cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED }}>
              This permanently deletes the organization, its workspaces, members and all data. Type the organization
              name to confirm.
            </p>
            <label style={{ ...UPPER, fontSize: 10, display: "block", marginBottom: 6 }}>
              {`Type "${items.find((i) => i.organization.id === confirmDeleteId)?.space.name ?? ""}" to confirm`}
            </label>
            <TextInput
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmDelete();
              }}
            />
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <PillButton
                variant="outline"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmName("");
                }}
              >
                Cancel
              </PillButton>
              <PillButton onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? <Loader2 className="animate-spin" size={14} /> : null}
                Delete permanently
              </PillButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ManagePanel({
  item,
  tab,
  setTab,
  onClose,
  onChanged,
}: {
  item: OrganizationListItem;
  tab: Tab;
  setTab: (t: Tab) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "settings", label: "Settings" },
    { id: "telegram", label: "Telegram" },
    { id: "members", label: "Admins & Members" },
    { id: "workspaces", label: "Workspaces" },
    { id: "apps", label: "Apps" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
          <Building2 size={16} color={MUTED} />
          {item.space.name}
        </span>
        <PillButton variant="ghost" onClick={onClose}>
          <X size={14} />
          Back to list
        </PillButton>
      </div>

      <div style={{ display: "flex", gap: 4, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-divider)", background: "var(--color-surface)", padding: 4 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: tab === t.id ? "var(--color-accent)" : "transparent",
              color: tab === t.id ? "#fff" : "var(--color-text)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <OrgSettingsSection organizationId={item.organization.id} onChanged={onChanged} />
      ) : null}
      {tab === "telegram" ? (
        <OrgTelegramSection organizationId={item.organization.id} onChanged={onChanged} />
      ) : null}
      {tab === "members" ? (
        <OrgMembersSection organizationId={item.organization.id} onChanged={onChanged} />
      ) : null}
      {tab === "workspaces" ? (
        <WorkspacesSection organizationId={item.organization.id} onChanged={onChanged} />
      ) : null}
      {tab === "apps" ? (
        <div>
          <OrgAppsList organizationId={item.organization.id} canEdit />
        </div>
      ) : null}
    </div>
  );
}
