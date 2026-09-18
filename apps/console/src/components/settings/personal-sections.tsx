"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ComposioConnectors } from "@/components/settings/composio-connectors";
import { GoogleConnectorCard } from "@/components/settings/google-connector-card";
import { cn } from "@/lib/utils";
import { CreateAgent } from "@/components/agents/CreateAgent";
import {
  createSkill,
  forgetMemory,
  getAgents,
  listMemory,
  listSkills,
  storeMemory,
  updateOwnProfile,
} from "@/lib/api-client";
import {
  Card,
  Field,
  SectionHeading,
  TextInput,
  Toggle,
} from "./section-primitives";

/* ------------------------------ Account ------------------------------ */

export function AccountSection() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.person?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!user?.person) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateOwnProfile(user.person.id, { email: email.trim() || null });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Account"
        description="Email, sign-in, and account details."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Display name">
          <TextInput value={user?.actor?.displayName ?? ""} readOnly />
        </Field>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {saved ? (
          <p className="text-sm text-emerald-600">Saved.</p>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" disabled={!user?.person || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Profile ------------------------------ */

export function ProfileSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.actor?.displayName ?? "");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!user?.person) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateOwnProfile(user.person.id, {
        profile: {
          selfDescribed: {
            role: { value: role.trim(), source: "self_declared" },
            bio: { value: bio.trim(), source: "self_declared" },
          },
        },
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Profile"
        description="How you appear across your spaces."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="lg" />
          <Button variant="outline" size="sm">
            Change avatar
          </Button>
        </div>
        <Field label="Full name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Role" hint="Shown next to your name in people lists.">
          <TextInput
            value={role}
            placeholder="e.g. Founder"
            onChange={(event) => setRole(event.target.value)}
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={3}
            value={bio}
            placeholder="A sentence about you."
            onChange={(event) => setBio(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
        <div className="flex justify-end">
          <Button size="sm" disabled={!user?.person || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save profile
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Memory ------------------------------ */

export function MemorySection() {
  const { user } = useAuth();
  const personId = user?.person?.id;
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof listMemory>>>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    listMemory("person", personId)
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  const add = async () => {
    const text = draft.trim();
    if (!text || !personId) return;
    setAdding(true);
    setError(null);
    try {
      const entry = await storeMemory({
        scope: "person",
        ownerId: personId,
        content: { note: text },
      });
      setEntries((prev) => [...prev, entry]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save memory.");
    } finally {
      setAdding(false);
    }
  };

  const forget = async (id: string) => {
    await forgetMemory(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const noteOf = (content: Record<string, unknown>): string =>
    typeof content.note === "string" ? content.note : JSON.stringify(content);

  return (
    <div>
      <SectionHeading
        title="Memory"
        description="Facts and preferences Jamot has learned about you."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{noteOf(entry.content)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  aria-label="Forget"
                  onClick={() => void forget(entry.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {entries.length === 0 && !loading ? (
          <p className="py-2 text-sm text-muted-foreground">No memories yet.</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <TextInput
            placeholder="e.g. Prefers brief updates before 10am"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <Button size="sm" disabled={!draft.trim() || !personId || adding} onClick={() => void add()}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}

/* --------------------------- Privacy & consent --------------------------- */

export function PrivacyConsentSection() {
  const [learning, setLearning] = useState(true);
  const [shareAcrossSpaces, setShareAcrossSpaces] = useState(false);
  const [exportOptIn, setExportOptIn] = useState(false);

  return (
    <div>
      <SectionHeading
        title="Privacy & Consent"
        description="Control what Jamot remembers and where it is used."
      />
      <Card className="max-w-xl">
        <Toggle
          checked={learning}
          onChange={setLearning}
          label="Learn from my activity"
          description="Allow Jamot to form new memories as you work."
        />
        <Toggle
          checked={shareAcrossSpaces}
          onChange={setShareAcrossSpaces}
          label="Share personal memory across spaces"
          description="Make personal memories available to organization spaces."
        />
        <Toggle
          checked={exportOptIn}
          onChange={setExportOptIn}
          label="Allow data export"
          description="Permit scheduled exports of your data."
        />
      </Card>
    </div>
  );
}

/* ------------------------------ Connectors ------------------------------ */

export function ConnectorsSection() {
  return (
    <div className="flex flex-col gap-4">
      <GoogleConnectorCard />
      <ComposioConnectors mode="personal" />
    </div>
  );
}

/* ------------------------------ Skills ------------------------------ */

export function SkillsSection() {
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof listSkills>>>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSkills()
      .then((items) => {
        if (!cancelled) setSkills(items);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const skill = await createSkill({ name, status: "draft" });
      setSkills((prev) => [...prev, skill]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create skill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Skills"
        description="Reusable capabilities your agents can use."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li key={skill.id}>
                <Badge variant="secondary">{skill.name}</Badge>
              </li>
            ))}
            {skills.length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">No skills yet.</li>
            ) : null}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <TextInput
            placeholder="New skill…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <Button size="sm" disabled={!draft.trim() || busy} onClick={() => void add()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}

/* --------------------------- Personal agents --------------------------- */

export function PersonalAgentsSection() {
  const [creating, setCreating] = useState(false);
  const [agents, setAgents] = useState<Awaited<ReturnType<typeof getAgents>>>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      setAgents(await getAgents());
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getAgents()
      .then((items) => {
        if (!cancelled) setAgents(items);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <SectionHeading
        title="Personal Agents"
        description="Agents that work only for you."
      />
      <Card className="max-w-xl">
        {loading ? (
          <p className="py-2 text-sm text-muted-foreground">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No agents yet. Create one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        agent.availability === "available"
                          ? "bg-emerald-500"
                          : agent.availability === "busy"
                            ? "bg-amber-500"
                            : "bg-zinc-400",
                      )}
                    />
                    {agent.role ?? agent.id}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{agent.availability}</Badge>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            <Plus className="size-4" />
            New agent
          </Button>
        </div>
      </Card>

      {creating ? (
        <div className="mt-4 max-w-xl">
          <CreateAgent onAdd={() => void reload()} onDone={() => setCreating(false)} />
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------- Notifications ---------------------------- */

const NOTIFICATION_PREFS_KEY = "jamot:notification-prefs";

interface NotificationPrefs {
  emailDigests: boolean;
  approvalRequests: boolean;
  activityMentions: boolean;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailDigests: true,
  approvalRequests: true,
  activityMentions: false,
};

function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadNotificationPrefs());
    setLoaded(true);
  }, []);

  const update = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — keep in-memory state
    }
  };

  return (
    <div>
      <SectionHeading
        title="Notifications"
        description="Choose what Jamot tells you about."
      />
      <Card className="max-w-xl">
        <Toggle
          checked={prefs.emailDigests}
          onChange={(next) => update("emailDigests", next)}
          label="Email digests"
          description="A daily summary of what happened."
          disabled={!loaded}
        />
        <Toggle
          checked={prefs.approvalRequests}
          onChange={(next) => update("approvalRequests", next)}
          label="Approval requests"
          description="Notify me when an agent needs my sign-off."
          disabled={!loaded}
        />
        <Toggle
          checked={prefs.activityMentions}
          onChange={(next) => update("activityMentions", next)}
          label="Activity mentions"
          description="Notify me when I am mentioned."
          disabled={!loaded}
        />
      </Card>
    </div>
  );
}

/* ------------------------------ Appearance ------------------------------ */

const ACCENTS = [
  { id: "violet", label: "Violet", color: "#7c3aed", foreground: "#ffffff" },
  { id: "warm", label: "Warm", color: "#f59e0b", foreground: "#1c1917" },
  { id: "blue", label: "Blue", color: "#3b82f6", foreground: "#ffffff" },
  { id: "green", label: "Green", color: "#10b981", foreground: "#022c22" },
] as const;

const ACCENT_KEY = "jamot:space-accent";
const ACCENT_FG_KEY = "jamot:space-accent-foreground";

function readStoredAccentId(): string {
  if (typeof window === "undefined") return "violet";
  const saved = window.localStorage.getItem(ACCENT_KEY);
  const match = ACCENTS.find((accent) => accent.color === saved);
  return match ? match.id : "violet";
}

export function AppearanceSection() {
  const [accentId, setAccentId] = useState<string>(readStoredAccentId);

  useEffect(() => {
    const accent = ACCENTS.find((candidate) => candidate.id === accentId);
    if (!accent) return;
    const root = document.documentElement;
    root.style.setProperty("--space-accent", accent.color);
    root.style.setProperty("--space-accent-foreground", accent.foreground);
    window.localStorage.setItem(ACCENT_KEY, accent.color);
    window.localStorage.setItem(ACCENT_FG_KEY, accent.foreground);
  }, [accentId]);

  const applyAccent = (id: string) => {
    setAccentId(id);
  };

  return (
    <div>
      <SectionHeading
        title="Appearance"
        description="Theme and accent color."
      />
      <div className="flex max-w-xl flex-col gap-6">
        <Card>
          <p className="mb-3 text-sm font-medium">Theme</p>
          <ThemeSwitcher />
        </Card>

        <Card>
          <p className="mb-3 text-sm font-medium">Space accent</p>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                onClick={() => applyAccent(accent.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  accentId === accent.id
                    ? "border-space-accent bg-muted"
                    : "border-border hover:bg-muted",
                )}
              >
                <span
                  className="size-4 rounded-full"
                  style={{ backgroundColor: accent.color }}
                />
                {accent.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------ Security ------------------------------ */

export function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [sessionLock, setSessionLock] = useState(false);

  return (
    <div>
      <SectionHeading
        title="Security"
        description="Authentication and session settings."
      />
      <div className="flex max-w-xl flex-col gap-4">
        <Card>
          <Toggle
            checked={twoFactor}
            onChange={setTwoFactor}
            label="Two-factor authentication"
            description="Require a second factor at sign-in."
          />
          <Toggle
            checked={sessionLock}
            onChange={setSessionLock}
            label="Lock sessions after inactivity"
            description="Sign out after 30 minutes of inactivity."
          />
        </Card>
        <Card>
          <p className="text-sm font-medium">Password</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Change your account password.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="New password">
              <TextInput type="password" placeholder="••••••••" />
            </Field>
            <div className="flex justify-end">
              <Button size="sm">Update password</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
