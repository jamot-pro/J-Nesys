"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { listMemory, storeMemory, forgetMemory, updateMemory } from "@/lib/api-client";
import { listTasks } from "@/components/tasks/tasks-api";
import { EditableField } from "./EditableField";
import {
  attachIdentity,
  getPersonDetail,
  removeIdentity,
  updatePerson,
  type ApiPersonDetail,
} from "./people-api";

type Tab =
  | "overview"
  | "memory"
  | "interactions"
  | "tasks"
  | "relationships"
  | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "memory", label: "Memory" },
  { id: "interactions", label: "Interactions" },
  { id: "tasks", label: "Tasks" },
  { id: "relationships", label: "Relationships" },
  { id: "activity", label: "Activity" },
];

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  matrix: "Matrix",
  email: "Email",
  google: "Google",
  google_contacts: "Google Contacts",
  web: "Web",
  manual: "Manual",
};

function channelLabel(provider: string): string {
  return CHANNEL_LABELS[provider] ?? provider;
}

function initials(detail: ApiPersonDetail): string {
  const first = detail.firstName?.[0] ?? "";
  const last = detail.lastName?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  const name = detail.actor?.displayName ?? "";
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function PersonProfilePanel({
  personId,
  spaceId,
  onBack,
}: {
  personId: string;
  spaceId: string | null;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<ApiPersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    try {
      setDetail(await getPersonDetail(personId));
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const saveField = useCallback(
    async (field: "firstName" | "lastName" | "phone" | "email", next: string | null) => {
      const updated = await updatePerson(personId, { [field]: next });
      setDetail(updated);
    },
    [personId],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <UserRound className="size-8" />
        <p className="text-sm">This person is no longer available.</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-foreground underline underline-offset-2"
        >
          Back to People
        </button>
      </div>
    );
  }

  const displayName =
    [detail.firstName, detail.lastName].filter(Boolean).join(" ") ||
    detail.actor?.displayName ||
    detail.phone ||
    detail.email ||
    "Unknown";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to people"
        >
          <ArrowLeft className="size-4" />
        </button>
        {detail.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.avatarUrl}
            alt={displayName}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-space-accent/15 text-sm font-medium text-foreground">
            {initials(detail)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[detail.phone, detail.email].filter(Boolean).join(" · ") ||
              detail.identities[0]?.value ||
              "No contact details yet"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-b-2 border-space-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "overview" ? (
          <OverviewTab detail={detail} onFieldSave={saveField} onChanged={load} />
        ) : tab === "memory" ? (
          <MemoryTab personId={personId} />
        ) : tab === "interactions" ? (
          <InteractionsTab detail={detail} kinds={["message.received", "message.sent"]} />
        ) : tab === "tasks" ? (
          <TasksTab spaceId={spaceId} actorId={detail.actorId} />
        ) : tab === "relationships" ? (
          <EmptyNote text="Relationships connect this person to people, agents and projects. They appear here as they are created." />
        ) : (
          <InteractionsTab detail={detail} kinds={null} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({
  detail,
  onFieldSave,
  onChanged,
}: {
  detail: ApiPersonDetail;
  onFieldSave: (
    field: "firstName" | "lastName" | "phone" | "email",
    next: string | null,
  ) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [provider, setProvider] = useState("whatsapp");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addIdentity = async () => {
    if (!value.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await attachIdentity(detail.id, { provider, value: value.trim() });
      setValue("");
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EditableField
          label="First name"
          value={detail.firstName}
          onSave={(next) => onFieldSave("firstName", next)}
        />
        <EditableField
          label="Last name"
          value={detail.lastName}
          onSave={(next) => onFieldSave("lastName", next)}
        />
        <EditableField
          label="Phone"
          value={detail.phone}
          onSave={(next) => onFieldSave("phone", next)}
        />
        <EditableField
          label="Email"
          value={detail.email}
          onSave={(next) => onFieldSave("email", next)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Channels & identities
        </h3>
        {detail.identities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No channel identities yet. Identities are attached automatically when
            this person messages you on a connected channel.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {detail.identities.map((identity) => (
              <li
                key={identity.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {channelLabel(identity.provider)}
                </span>
                <span className="min-w-0 flex-1 truncate">{identity.value}</span>
                <span className="text-xs text-muted-foreground">
                  source: {identity.source}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await removeIdentity(detail.id, identity.id);
                    await onChanged();
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                  aria-label={`Remove ${identity.provider} identity`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-1 flex items-center gap-2">
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="matrix">Matrix</option>
            <option value="email">Email</option>
            <option value="google">Google</option>
          </select>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Identifier (number, @handle, email…)"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
          />
          <button
            type="button"
            disabled={adding || !value.trim()}
            onClick={() => void addIdentity()}
            className="flex items-center gap-1 rounded-md bg-space-accent px-2.5 py-1.5 text-sm font-medium text-space-accent-foreground disabled:opacity-50"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}

function MemoryTab({ personId }: { personId: string }) {
  const [notes, setNotes] = useState<
    { id: string; content: Record<string, unknown>; createdAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const load = useCallback(async () => {
    try {
      const items = await listMemory("person", personId);
      setNotes(items);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await storeMemory({
        scope: "person",
        ownerId: personId,
        content: { note: draft.trim() },
        provenance: { source: "self_declared", confidence: 1 },
      });
      setDraft("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        What Jamot remembers about this person — preferences, context and notes.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
          placeholder="Add a memory note…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
        />
        <button
          type="button"
          disabled={saving || !draft.trim()}
          onClick={() => void add()}
          className="rounded-md bg-space-accent px-2.5 py-1.5 text-sm font-medium text-space-accent-foreground disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No memories yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {notes.map((note) => {
            const text = String(
              (note.content as { note?: unknown }).note ?? JSON.stringify(note.content),
            );
            const isEditing = editingId === note.id;
            const commitEdit = async () => {
              setEditingId(null);
              const next = editDraft.trim();
              if (!next || next === text) return;
              await updateMemory(note.id, {
                content: { note: next },
                provenance: { source: "self_declared", confidence: 1 },
              });
              await load();
            };
            return (
              <li
                key={note.id}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    onBlur={() => void commitEdit()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void commitEdit();
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(note.id);
                      setEditDraft(text);
                    }}
                    className="min-w-0 flex-1 cursor-text whitespace-pre-wrap text-left hover:bg-muted/50 rounded px-0.5"
                    title="Click to edit"
                  >
                    {text}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await forgetMemory(note.id);
                    await load();
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                  aria-label="Forget memory"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function InteractionsTab({
  detail,
  kinds,
}: {
  detail: ApiPersonDetail;
  kinds: string[] | null;
}) {
  const items = useMemo(() => {
    const list = detail.interactions ?? [];
    if (!kinds) return list;
    return list.filter((event) => kinds.includes(event.type));
  }, [detail.interactions, kinds]);

  if (items.length === 0) {
    return <EmptyNote text="No interactions recorded yet. Messages from connected channels appear here." />;
  }

  return (
    <ul className="mx-auto flex max-w-2xl flex-col gap-1.5">
      {items.map((event) => {
        const payload = event.payload as {
          text?: unknown;
          sender?: unknown;
          provider?: unknown;
        };
        return (
          <li
            key={event.id}
            className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              {typeof payload.text === "string" && payload.text ? (
                <p className="truncate">{payload.text}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {event.type}
                {typeof payload.provider === "string" ? ` · ${payload.provider}` : ""}
                {typeof payload.sender === "string" ? ` · ${payload.sender}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatWhen(event.occurredAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function TasksTab({ spaceId, actorId }: { spaceId: string | null; actorId: string }) {
  const [tasks, setTasks] = useState<{ id: string; title: string; status?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listTasks(spaceId)
      .then((items) => {
        if (cancelled) return;
        setTasks(
          items
            .filter((task) => task.assigneeActorIds.includes(actorId))
            .map((task) => ({ id: task.id, title: task.title })),
        );
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId, actorId]);

  if (loading) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (tasks.length === 0) {
    return <EmptyNote text="No tasks assigned to this person yet." />;
  }
  return (
    <ul className="mx-auto flex max-w-2xl flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-md border border-border px-3 py-2 text-sm">
          {task.title}
        </li>
      ))}
    </ul>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {text.includes("interaction") ? (
        <MessageSquare className="mt-0.5 size-4 shrink-0" />
      ) : text.includes("email") ? (
        <Mail className="mt-0.5 size-4 shrink-0" />
      ) : text.includes("Phone") ? (
        <Phone className="mt-0.5 size-4 shrink-0" />
      ) : (
        <UserRound className="mt-0.5 size-4 shrink-0" />
      )}
      {text}
    </div>
  );
}
