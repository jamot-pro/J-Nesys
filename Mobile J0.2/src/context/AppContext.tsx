import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  authTelegram,
  createPersonMemory,
  deletePersonMemory,
  listPersonMemory,
  listTasksForActor,
  patchPerson,
  patchTaskStatus,
} from "../lib/api";
import { initTelegram } from "../lib/telegram";
import type {
  Availability,
  AvailabilityRule,
  ChatMessage,
  MemoryEntry,
  Person,
  Screen,
  Task,
} from "../types";

const DEFAULT_RULES: AvailabilityRule[] = [
  { id: "quiet-hours", label: "No new tasks after 16:00", on: false },
  { id: "nearby-only", label: "Only tasks within 20 km of me", on: false },
  { id: "allow-override", label: "Let Jamot override when urgent", on: false },
];

function readAvailability(person: Person): Availability {
  const stored = person.profile.preferences.availability?.value as Partial<Availability> | undefined;
  return {
    available: stored?.available ?? true,
    rules: stored?.rules?.length ? stored.rules : DEFAULT_RULES,
  };
}

function readStringList(person: Person, key: string): string[] {
  const value = person.profile.selfDescribed[key]?.value;
  return Array.isArray(value) ? (value as string[]) : [];
}

function readPreferenceText(person: Person, key: string): string {
  const value = person.profile.preferences[key]?.value;
  return typeof value === "string" ? value : "";
}

interface AppContextType {
  booting: boolean;
  authError: string | null;
  actionError: string | null;
  dismissActionError: () => void;
  person: Person | null;
  actorId: string | null;
  trustScore: number | null;
  screen: Screen;
  goHome: () => void;
  goTalk: () => void;
  goTasks: () => void;
  openProfile: () => void;

  tasks: Task[];
  acceptTask: (id: string) => Promise<boolean>;
  declineTask: (id: string) => Promise<boolean>;
  completeTask: (id: string) => Promise<boolean>;
  openTaskId: string | null;
  toggleTaskOpen: (id: string) => void;

  availability: Availability;
  toggleAvailability: () => Promise<boolean>;
  setAvailability: (available: boolean) => Promise<boolean>;
  toggleRule: (ruleId: string) => Promise<boolean>;

  skills: string[];
  languages: string[];
  territory: string[];
  addChip: (group: "skills" | "languages" | "territory", value: string) => Promise<boolean>;
  removeChip: (group: "skills" | "languages" | "territory", value: string) => Promise<boolean>;

  fields: { role: string; hours: string; taskLoad: string; channel: string };
  updateFieldLocal: (key: "role" | "hours" | "taskLoad" | "channel", value: string) => void;
  commitField: (key: "role" | "hours" | "taskLoad" | "channel") => void;

  memories: MemoryEntry[];
  addMemory: (text: string) => Promise<boolean>;
  removeMemory: (id: string) => Promise<boolean>;

  messages: ChatMessage[];
  draft: string;
  setDraft: (v: string) => void;
  thinking: boolean;
  send: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  }, []);
  const [person, setPerson] = useState<Person | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", who: "jamot", text: "Morning. Tell me what's happening and I'll take it from there." },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    initTelegram();
    let cancelled = false;
    (async () => {
      try {
        const auth = await authTelegram();
        if (cancelled) return;
        setPerson(auth.person);
        setActorId(auth.actor.id);
        setTrustScore(auth.reputation.reputationStars);
        const [taskItems, memoryItems] = await Promise.all([
          listTasksForActor(auth.actor.id).catch(() => []),
          listPersonMemory(auth.person.id).catch(() => []),
        ]);
        if (cancelled) return;
        setTasks(taskItems);
        setMemories(memoryItems);
      } catch (err) {
        if (!cancelled) setAuthError(err instanceof Error ? err.message : "Could not sign in");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistPreference = useCallback(
    async (key: string, value: unknown) => {
      if (!person) return;
      const updated = await patchPerson(person.id, { profile: { preferences: { [key]: { value } } } });
      setPerson(updated);
    },
    [person],
  );

  const persistSelfDescribed = useCallback(
    async (key: string, value: unknown) => {
      if (!person) return;
      const updated = await patchPerson(person.id, { profile: { selfDescribed: { [key]: { value } } } });
      setPerson(updated);
    },
    [person],
  );

  const availability = person ? readAvailability(person) : { available: true, rules: DEFAULT_RULES };

  const setAvailability = useCallback(
    (available: boolean) =>
      runAction(async () => {
        if (!person) return;
        const next: Availability = { ...readAvailability(person), available };
        setPerson({ ...person, profile: { ...person.profile, preferences: { ...person.profile.preferences, availability: { value: next, source: "self_declared", confidence: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } } });
        await persistPreference("availability", next);
      }),
    [person, persistPreference, runAction],
  );

  const toggleAvailability = useCallback(
    () => setAvailability(!availability.available),
    [availability.available, setAvailability],
  );

  const toggleRule = useCallback(
    (ruleId: string) =>
      runAction(async () => {
        if (!person) return;
        const current = readAvailability(person);
        const next: Availability = {
          ...current,
          rules: current.rules.map((r) => (r.id === ruleId ? { ...r, on: !r.on } : r)),
        };
        await persistPreference("availability", next);
      }),
    [person, persistPreference, runAction],
  );

  const skills = person?.profile.skills ?? [];
  const languages = person ? readStringList(person, "languages") : [];
  const territory = person ? readStringList(person, "territory") : [];

  const addChip = useCallback(
    (group: "skills" | "languages" | "territory", value: string) =>
      runAction(async () => {
        const trimmed = value.trim();
        if (!trimmed || !person) return;
        if (group === "skills") {
          if (skills.includes(trimmed)) return;
          const next = [...skills, trimmed];
          const updated = await patchPerson(person.id, { profile: { skills: next } });
          setPerson(updated);
        } else {
          const current = group === "languages" ? languages : territory;
          if (current.includes(trimmed)) return;
          const next = [...current, trimmed];
          await persistSelfDescribed(group, next);
        }
      }),
    [person, skills, languages, territory, persistSelfDescribed, runAction],
  );

  const removeChip = useCallback(
    (group: "skills" | "languages" | "territory", value: string) =>
      runAction(async () => {
        if (!person) return;
        if (group === "skills") {
          const next = skills.filter((s) => s !== value);
          const updated = await patchPerson(person.id, { profile: { skills: next } });
          setPerson(updated);
        } else {
          const next = (group === "languages" ? languages : territory).filter((s) => s !== value);
          await persistSelfDescribed(group, next);
        }
      }),
    [person, skills, languages, territory, persistSelfDescribed, runAction],
  );

  const fields = person
    ? {
        role: readPreferenceText(person, "role"),
        hours: readPreferenceText(person, "hours"),
        taskLoad: readPreferenceText(person, "taskLoad"),
        channel: readPreferenceText(person, "channel"),
      }
    : { role: "", hours: "", taskLoad: "", channel: "" };

  const updateFieldLocal = useCallback(
    (key: "role" | "hours" | "taskLoad" | "channel", value: string) => {
      setPerson((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            preferences: {
              ...prev.profile.preferences,
              [key]: { value, source: "self_declared", confidence: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            },
          },
        };
      });
    },
    [],
  );

  const pendingCommit = useRef<Record<string, string>>({});
  const commitField = useCallback(
    (key: "role" | "hours" | "taskLoad" | "channel") => {
      if (!person) return;
      const value = person.profile.preferences[key]?.value;
      if (typeof value !== "string") return;
      if (pendingCommit.current[key] === value) return;
      pendingCommit.current[key] = value;
      void persistPreference(key, value);
    },
    [person, persistPreference],
  );

  const acceptTask = useCallback(
    (id: string) =>
      runAction(async () => {
        const updated = await patchTaskStatus(id, "started");
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }),
    [runAction],
  );
  const declineTask = useCallback(
    (id: string) =>
      runAction(async () => {
        const updated = await patchTaskStatus(id, "cancelled");
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }),
    [runAction],
  );
  const completeTask = useCallback(
    (id: string) =>
      runAction(async () => {
        const updated = await patchTaskStatus(id, "completed");
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setOpenTaskId(null);
      }),
    [runAction],
  );
  const toggleTaskOpen = useCallback((id: string) => {
    setOpenTaskId((prev) => (prev === id ? null : id));
  }, []);

  const addMemory = useCallback(
    (text: string) =>
      runAction(async () => {
        if (!person || !text.trim()) return;
        const entry = await createPersonMemory(person.id, text.trim());
        setMemories((prev) => [entry, ...prev]);
      }),
    [person, runAction],
  );
  const removeMemory = useCallback(
    (id: string) =>
      runAction(async () => {
        await deletePersonMemory(id);
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }),
    [runAction],
  );

  const reply = useCallback((text: string, action?: string) => {
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), who: "jamot", text, action }]);
    }, 650);
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), who: "you", text }]);
    const t = text.toLowerCase();
    if (/unavailable|not available|off for|can't take/.test(t)) {
      const ok = await setAvailability(false);
      reply(
        ok ? "Done. You're unavailable — I won't assign anything new until you tell me otherwise." : "I couldn't update your availability just now.",
        ok ? "Availability set to unavailable" : undefined,
      );
      return;
    }
    if (/available|back on|i'm on/.test(t)) {
      const ok = await setAvailability(true);
      reply(ok ? "You're available. I'll route what fits." : "I couldn't update your availability just now.", ok ? "Availability set to available" : undefined);
      return;
    }
    if (/remember|i'm good at|i am good at/.test(t)) {
      const ok = await addMemory(text.replace(/^remember (that )?/i, ""));
      reply(
        ok ? "Noted. I'll factor that in when choosing what to send you." : "I couldn't save that just now.",
        ok ? "Saved to your profile" : undefined,
      );
      return;
    }
    if (/delivered|done|closed|signed|completed/.test(t)) {
      const active = tasks.find((task) => task.status === "started");
      if (active) {
        const ok = await completeTask(active.id);
        reply(
          ok ? `Great — marked "${active.title}" complete. Anything else?` : `I couldn't mark "${active.title}" complete just now.`,
          ok ? "Task updated · outcome recorded" : undefined,
        );
      } else {
        reply("I don't see an active task to close out right now.");
      }
      return;
    }
    if (/what should i do|what now|next/.test(t)) {
      const next = tasks.find((task) => task.status === "assigned" || task.status === "created");
      reply(
        next ? `Head to "${next.title}" next — it's waiting on you.` : "You're clear for now — nothing waiting on you.",
        next ? "Next action proposed" : undefined,
      );
      return;
    }
    reply("Got it. I'll take it from here and tell you if anything needs you.", "Logged to memory");
  }, [draft, tasks, setAvailability, addMemory, completeTask, reply]);

  return (
    <AppContext.Provider
      value={{
        booting,
        authError,
        actionError,
        dismissActionError: () => setActionError(null),
        person,
        actorId,
        trustScore,
        screen,
        goHome: () => setScreen("home"),
        goTalk: () => setScreen("talk"),
        goTasks: () => setScreen("tasks"),
        openProfile: () => setScreen("profile"),
        tasks,
        acceptTask,
        declineTask,
        completeTask,
        openTaskId,
        toggleTaskOpen,
        availability,
        toggleAvailability,
        setAvailability,
        toggleRule,
        skills,
        languages,
        territory,
        addChip,
        removeChip,
        fields,
        updateFieldLocal,
        commitField,
        memories,
        addMemory,
        removeMemory,
        messages,
        draft,
        setDraft,
        thinking,
        send,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
};
