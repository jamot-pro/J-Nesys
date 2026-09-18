"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import { Bot, Loader2, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { listActors, type ApiActor } from "@/lib/api-client";

type MentionTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const MENTION_RE = /@([\w.\- ]*)$/;

// A mention token embeds the resolved actor id so the agent never has to guess.
// Format: @Name(actor:<actorId>)
export const ACTOR_REF_RE = /@([^()\n]+)\(actor:([^()\n]+)\)/g;

export interface ActorRef {
  name: string;
  actorId: string;
}

/** Extract every embedded actor reference from a message string. */
export function parseActorRefs(text: string): ActorRef[] {
  const refs: ActorRef[] = [];
  const re = new RegExp(ACTOR_REF_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = match[1]?.trim();
    const actorId = match[2]?.trim();
    if (name && actorId) refs.push({ name, actorId });
  }
  return refs;
}

export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  MentionTextareaProps
>(function MentionTextarea(
  {
    value = "",
    onChange,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    autoFocus,
    className,
    placeholder,
    style,
  },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [actors, setActors] = useState<ApiActor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const composingRef = useRef(false);

  // Load the candidate actors (people + agents) once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listActors()
      .then((items) => {
        if (!cancelled) setActors(items);
      })
      .catch(() => {
        // ignore — no actors means the picker stays empty
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const detectMention = useCallback((text: string, caret: number) => {
    const beforeCaret = text.slice(0, caret);
    const match = MENTION_RE.exec(beforeCaret);
    if (!match) {
      setOpen(false);
      setToken("");
      return;
    }
    const nextToken = match[1] ?? "";
    setToken(nextToken);
    setOpen(true);
    // Only reset the highlighted row when the typed token actually changes;
    // preserve it across arrow-key navigation (which triggers onKeyUp too).
    setActiveIndex((prev) => (nextToken === token ? prev : 0));
  }, [token]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange?.(e);
      detectMention(next, e.target.selectionStart ?? next.length);
    },
    [onChange, detectMention],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      detectMention(el.value, el.selectionStart ?? el.value.length);
    },
    [detectMention],
  );

  const selectActor = useCallback(
    (actor: ApiActor) => {
      const el = textareaRef.current;
      if (!el) return;
      const text = el.value;
      const caret = el.selectionStart ?? text.length;
      const beforeCaret = text.slice(0, caret);
      const match = MENTION_RE.exec(beforeCaret);
      const start = match ? caret - match[0].length : caret;
      const token = `@${actor.displayName}(actor:${actor.id}) `;
      const next = text.slice(0, start) + token + text.slice(caret);
      // The textarea is controlled by CopilotKit; onChange reads only e.target.value.
      onChange?.({
        target: { value: next },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
      setOpen(false);
      setToken("");
      // restore focus + place caret after the inserted mention
      requestAnimationFrame(() => {
        const pos = start + token.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [onChange],
  );

  const filtered = useMemo(() => {
    const q = token.trim().toLowerCase();
    if (!q) return actors;
    return actors.filter((a) =>
      a.displayName.toLowerCase().includes(q),
    );
  }, [actors, token]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (composingRef.current) {
        onKeyDown?.(e);
        return;
      }
      if (open && filtered.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % filtered.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const actor = filtered[activeIndex];
          if (actor) selectActor(actor);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          setToken("");
          return;
        }
      }
      onKeyDown?.(e);
    },
    [open, filtered, activeIndex, selectActor, onKeyDown],
  );

  return (
    <div className="relative flex-1">
      <textarea
        ref={(node) => {
          textareaRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onCompositionStart={(e) => {
          composingRef.current = true;
          onCompositionStart?.(e);
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onCompositionEnd?.(e);
        }}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={cn(
          "min-h-[44px] w-full resize-none bg-transparent py-3 pr-5 text-base outline-none antialiased placeholder:text-muted-foreground",
          className,
        )}
        style={{ overflow: "auto", ...style }}
        rows={1}
      />

      {open && (
        <div className="glass-card glass-border absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl shadow-2xl">
          {loading && filtered.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading people…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No people or agents found
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto p-1">
              {filtered.map((actor, i) => (
                <li key={actor.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectActor(actor)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors",
                      i === activeIndex ? "bg-space-accent/10 text-space-accent font-medium" : "text-foreground hover:bg-muted/70",
                    )}
                  >
                    {actor.type === "agent" ? (
                      <Bot className="size-3.5 shrink-0 text-space-accent/80" />
                    ) : (
                      <User className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{actor.displayName}</span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {actor.type === "agent" ? "Agent" : "Person"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});
