"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, Field } from "@/components/settings/section-primitives";
import { OrgAppsList } from "@/components/settings/org-apps-list";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { OrgMembersSection } from "@/components/settings/org-members-section";
import { WorkspacesSection } from "@/components/settings/workspaces-section";
import { BrandLogo } from "@/components/brand-logo";
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

const ROLE_VARIANT: Record<
  NonNullable<OrgRole>,
  "default" | "secondary" | "outline" | "accent"
> = {
  owner: "default",
  admin: "accent",
  member: "secondary",
  agent: "outline",
  external: "outline",
};

type Tab = "settings" | "members" | "workspaces" | "apps";

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
      <div className="flex h-dvh w-full items-center justify-center bg-background p-6 text-foreground">
        <Card className="flex max-w-md flex-col items-center gap-3 text-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <h1 className="font-display text-lg font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            Only super admins can view this console.
          </p>
          <Button onClick={() => router.push("/")}>Back to home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <BrandLogo className="size-5" forceJamot />
        </Link>
        <span className="font-display text-sm font-semibold">Admin</span>
      </header>

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-8 py-6">
        <div className="w-full max-w-3xl">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="size-6 text-space-accent" />
            <div>
              <h1 className="font-display text-lg font-semibold tracking-tight">
                Super Admin Console
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage every organization, its admins, subdomains, logos and workspaces.
              </p>
            </div>
          </div>

          <Card className="mb-6 flex max-w-3xl flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input
                placeholder="New organization name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-sm font-medium">Subdomain</label>
              <Input
                placeholder="organization"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
              />
            </div>
            <div className="min-w-0 flex-[2]">
              <label className="mb-1.5 block text-sm font-medium">Dream</label>
              <Input
                placeholder="Optional long-term vision"
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void createOrg();
                }}
              />
            </div>
            <Button onClick={() => void createOrg()} disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
              Create
            </Button>
          </Card>

          {createError ? <p className="mb-3 text-sm text-red-600">{createError}</p> : null}
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

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
            <p className="text-sm text-muted-foreground">Loading organizations…</p>
          ) : items.length === 0 ? (
            <Card className="max-w-3xl">
              <p className="text-sm text-muted-foreground">No organizations yet.</p>
            </Card>
          ) : (
            <div className="flex max-w-3xl flex-col gap-2">
              {items.map((item) => {
                return (
                  <Card key={item.organization.id} className="flex flex-col gap-3 p-0">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      {item.organization.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveLogoUrl(item.organization.logoUrl) ?? ""}
                          alt={item.space.name}
                          className="size-9 shrink-0 rounded-md border border-border object-contain"
                        />
                      ) : (
                        <Building2 className="size-9 shrink-0 text-muted-foreground" />
                      )}

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{item.space.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.organization.slug && ROOT_DOMAIN
                            ? `${item.organization.slug}.${ROOT_DOMAIN}`
                            : item.organization.dream || "No subdomain or dream set"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{item.workspaces.length} workspace(s)</span>
                        <span>{item.organization.enabledAppIds.length} apps</span>
                        {item.role ? (
                          <Badge variant={ROLE_VARIANT[item.role]}>{item.role}</Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedId(item.organization.id);
                            setTab("settings");
                          }}
                        >
                          Manage
                        </Button>
                        <Button size="sm" onClick={() => openOrg(item)}>
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          aria-label={`Delete ${item.space.name}`}
                          onClick={() => setConfirmDeleteId(item.organization.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {confirmDeleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <Card className="w-full max-w-md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Delete organization</h2>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmName("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              This permanently deletes the organization, its workspaces, members and all data.
              Type the organization name to confirm.
            </p>
            <Field label={`Type "${items.find((i) => i.organization.id === confirmDeleteId)?.space.name ?? ""}" to confirm`}>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmDelete();
                }}
              />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setConfirmName("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
                Delete permanently
              </Button>
            </div>
          </Card>
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
    { id: "members", label: "Admins & Members" },
    { id: "workspaces", label: "Workspaces" },
    { id: "apps", label: "Apps" },
  ];
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="size-4 text-muted-foreground" />
            {item.space.name}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
          Back to list
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-space-accent text-space-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <OrgSettingsSection organizationId={item.organization.id} onChanged={onChanged} />
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
