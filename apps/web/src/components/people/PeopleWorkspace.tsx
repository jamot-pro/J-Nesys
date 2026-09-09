"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Search, UserPlus, Users } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { cn } from "@/lib/utils";
import { PeopleLists } from "./PeopleLists";
import { PersonProfilePanel } from "./PersonProfilePanel";
import { MergeReview } from "./MergeReview";
import {
  createContact,
  searchPeople,
  type ApiPersonSummary,
} from "./people-api";
import {
  consumeAddPerson,
  isAddPersonPending,
  subscribeAddPerson,
} from "./add-person-signal";

const PAGE_SIZE = 50;

const CHANNEL_FILTERS = [
  { value: "", label: "All channels" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "matrix", label: "Matrix" },
  { value: "email", label: "Email" },
  { value: "google", label: "Google" },
];

const SORTS = [
  { value: "recently_active", label: "Recently active" },
  { value: "recently_added", label: "Recently added" },
  { value: "name", label: "Name" },
] as const;

function initials(person: ApiPersonSummary): string {
  const first = person.firstName?.[0] ?? "";
  const last = person.lastName?.[0] ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return person.displayName.slice(0, 2).toUpperCase() || "?";
}

function relativeWhen(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PeopleWorkspace() {
  const { space } = useAppShell();
  const { user } = useAuth();
  return (
    <PeopleDirectory
      key={space.id}
      spaceName={space.name}
      spaceId={space.spaceId ?? user?.person?.membershipSpaceIds[0] ?? null}
    />
  );
}

function PeopleDirectory({
  spaceName,
  spaceId,
}: {
  spaceName: string;
  spaceId: string | null;
}) {
  const [tab, setTab] = useState<"directory" | "lists">("directory");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [channel, setChannel] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("recently_active");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ApiPersonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(() => isAddPersonPending());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const load = useCallback(async () => {
    if (!spaceId) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    try {
      const result = await searchPeople({
        spaceId,
        q: debouncedQuery || undefined,
        channel: channel || undefined,
        sort,
        page,
        perPage: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [spaceId, debouncedQuery, channel, sort, page]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Realtime: refresh the list when people change in this space (SSE).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEventStream(spaceId, (event) => {
    if (!event.type.startsWith("person.") && event.type !== "message.received") return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void load(), 500);
  });

  useEffect(() => {
    const unsubscribe = subscribeAddPerson(() => setAdding(true));
    if (isAddPersonPending()) consumeAddPerson();
    return unsubscribe;
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 people";
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `${start}–${end} of ${total}`;
  }, [page, total]);

  const selected = selectedId ?? null;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 pt-1.5">
        <button
          type="button"
          onClick={() => setTab("directory")}
          className={cn(
            "rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "directory"
              ? "border-b-2 border-space-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Directory
        </button>
        <button
          type="button"
          onClick={() => setTab("lists")}
          className={cn(
            "rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "lists"
              ? "border-b-2 border-space-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Lists
        </button>
      </div>

      {tab === "lists" ? (
        <PeopleLists spaceId={spaceId} orgId={undefined} />
      ) : selected ? (
        <PersonProfilePanel
          personId={selected}
          spaceId={spaceId}
          onBack={() => {
            setSelectedId(null);
            void load();
          }}
        />
      ) : (
        <>
          {spaceId ? (
            <MergeReview spaceId={spaceId} onChanged={() => void load()} />
          ) : null}

          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search people in ${spaceName}…`}
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-space-accent"
              />
            </div>
            <select
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {CHANNEL_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as (typeof SORTS)[number]["value"]);
                setPage(1);
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-md bg-space-accent px-2.5 py-1.5 text-sm font-medium text-space-accent-foreground transition-opacity hover:opacity-90"
            >
              <UserPlus className="size-3.5" /> Add
            </button>
          </div>

          <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Loader2}
                  title="Loading people…"
                  description="Fetching people for this space."
                />
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Users}
                  title={debouncedQuery ? "No people match your search" : "No people here yet"}
                  description={
                    debouncedQuery
                      ? `“${debouncedQuery}” didn’t match anyone in this space.`
                      : "People appear here automatically when they contact you on a connected channel — or add them manually."
                  }
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(person.id)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                      >
                        {person.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.avatarUrl}
                            alt=""
                            className="size-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-space-accent/15 text-xs font-medium">
                            {initials(person)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {person.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[person.relationship, person.email ?? person.phone]
                              .filter(Boolean)
                              .join(" · ") || " "}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {person.channels.map((provider) => (
                            <span
                              key={provider}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                              {provider}
                            </span>
                          ))}
                        </span>
                        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                          {relativeWhen(person.lastInteractionAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span>{rangeLabel}</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-border p-1 transition-colors hover:text-foreground disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span>
                  {page} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount || loading}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="rounded-md border border-border p-1 transition-colors hover:text-foreground disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </span>
            </div>
          </section>
        </>
      )}

      <AnimatePresence>
        {adding ? (
          <AddContactModal
            spaceId={spaceId}
            onDone={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              setPage(1);
              void load();
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AddContactModal({
  spaceId,
  onDone,
  onCreated,
}: {
  spaceId: string | null;
  onDone: () => void;
  onCreated: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!spaceId) {
      setError("No space selected.");
      return;
    }
    if (!firstName.trim() && !lastName.trim() && !email.trim() && !phone.trim()) {
      setError("Add at least a name, email or phone.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createContact(spaceId, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div
        className="absolute inset-0 z-20 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDone}
      />
      <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-4">
        <motion.div
          className="my-auto w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <h2 className="text-sm font-semibold">Add a person</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Only add what you know — Jamot never invents missing details.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
            />
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Last name"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
            />
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone"
              className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
            />
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onDone}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="rounded-md bg-space-accent px-3 py-1.5 text-sm font-medium text-space-accent-foreground disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add person"}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
