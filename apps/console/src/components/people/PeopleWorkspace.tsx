"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, UserPlus } from "lucide-react";

import { useConsole, useOrgScope } from "@/components/console-context";
import { useAuth } from "@/components/auth/auth-context";
import { useEventStream } from "@/lib/use-event-stream";
import { PeopleLists } from "./PeopleLists";
import { PersonProfilePanel } from "./PersonProfilePanel";
import { MergeReview } from "./MergeReview";
import { createContact } from "./people-api";
import {
  consumeAddPerson,
  isAddPersonPending,
  subscribeAddPerson,
} from "./add-person-signal";

export function PeopleWorkspace() {
  const { spaceId } = useOrgScope();
  const { branding } = useConsole();
  const { user } = useAuth();
  return (
    <PeopleDirectory
      key={spaceId}
      spaceName={branding.displayName}
      spaceId={spaceId ?? user?.person?.membershipSpaceIds[0] ?? null}
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
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(() => isAddPersonPending());
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Realtime: re-fetch lists/unlisted when people change in this space (SSE).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEventStream(spaceId, (event) => {
    if (!event.type.startsWith("person.") && event.type !== "message.received") return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshKey((k) => k + 1), 500);
  });

  useEffect(() => {
    const unsubscribe = subscribeAddPerson(() => setAdding(true));
    if (isAddPersonPending()) consumeAddPerson();
    return unsubscribe;
  }, []);

  const selected = selectedId ?? null;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {selected ? (
        <PersonProfilePanel
          personId={selected}
          spaceId={spaceId}
          onBack={() => {
            setSelectedId(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : (
        <>
          {spaceId ? (
            <MergeReview spaceId={spaceId} onChanged={() => setRefreshKey((k) => k + 1)} />
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
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-md bg-space-accent px-2.5 py-1.5 text-sm font-medium text-space-accent-foreground transition-opacity hover:opacity-90"
            >
              <UserPlus className="size-3.5" /> Add
            </button>
          </div>

          <PeopleLists
            key={refreshKey}
            spaceId={spaceId}
            orgId={undefined}
            query={debouncedQuery}
            onSelectPerson={setSelectedId}
          />
        </>
      )}

      <AnimatePresence>
        {adding ? (
          <AddContactModal
            spaceId={spaceId}
            onDone={() => setAdding(false)}
            onCreated={() => {
              setAdding(false);
              setRefreshKey((k) => k + 1);
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
