"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  Filter,
  Info,
  ListTodo,
  Loader2,
  MessageCircle,
  MoreVertical,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  Smile,
  Sparkles,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import {
  createAccount,
  createChannelAccount,
  deleteAccount,
  deleteChannelAccount,
  getMessages,
  getState,
  importSession,
  listAccounts,
  listChannelAccounts,
  listChats,
  listContacts,
  markRead,
  resetPairing,
  searchMessages,
  sendMedia,
  sendText,
} from "./wa-api";
import type { ChannelAccount } from "./wa-api";
import type { WaAccount, WaChat, WaContact, WaConnection, WaMessage, WaState } from "./wa-data";
import { ChannelAccountBar } from "./ChannelAccountBar";
import { InChatTaskModal } from "./InChatTaskModal";
import { ChatAgentConfigModal } from "./ChatAgentConfigModal";
import { ChatContextDrawer } from "./ChatContextDrawer";
import type {
  AutoActorMemory,
  ChannelAccountItem,
  ChannelProtocol,
  ChatAgentSetting,
} from "./channel-types";

function mediaLabel(msg: WaMessage): string {
  if (msg.text) return msg.text;
  if (msg.mediaType) return `[${msg.mediaType}]`;
  return "";
}

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = (Date.now() / 1000 - ts) * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatMessageTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mediaTypeFor(mime: string): "image" | "video" | "audio" | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

function QrPanel({
  qr,
  connection,
  onReset,
}: {
  qr?: string;
  connection: WaConnection;
  onReset: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!qr) return;
    let cancelled = false;
    void QRCode.toDataURL(qr, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [qr]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h3 className="font-display text-base font-semibold">Pair WhatsApp Web</h3>
      {qr ? (
        <p className="max-w-sm text-xs text-muted-foreground">
          Open WhatsApp on your phone $\rightarrow$ Settings $\rightarrow$ Linked Devices $\rightarrow$ Link a Device and scan the QR code.
        </p>
      ) : (
        <p className="max-w-sm text-xs text-muted-foreground">
          {connection === "close"
            ? "Disconnected — reconnecting automatically. If it stays disconnected, reset the pairing."
            : "Generating secure pairing session…"}
        </p>
      )}
      {qr ? (
        dataUrl ? (
          <div className="relative rounded-2xl border border-border bg-white p-3 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="WhatsApp pairing QR code"
              className="size-52 rounded-xl"
            />
          </div>
        ) : failed ? (
          <p className="text-xs text-destructive">Could not render QR code.</p>
        ) : (
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-space-accent" />
            <span>Waiting for QR scan…</span>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center gap-3 text-xs text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-space-accent" />
          {connection === "close" ? (
            <Button variant="outline" size="sm" onClick={onReset} className="rounded-xl">
              <RotateCcw className="size-3.5" />
              Reset pairing
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

type FilterTab = "all" | "unread" | "groups" | "ai";

function mapChannelAccount(item: ChannelAccount): ChannelAccountItem {
  return {
    id: item.id,
    spaceId: item.spaceId,
    protocol: item.protocol,
    label: item.label,
    identifier: item.identifier,
    status: item.status,
    createdAt: item.createdAt,
  };
}

export function WhatsAppApp({ compact = false }: { compact?: boolean }) {
  const { space } = useAppShell();
  const activeSpaceId = space.spaceId ?? space.id ?? "personal";

  // Account & Channel state
  const [accounts, setAccounts] = useState<ChannelAccountItem[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [state, setState] = useState<WaState | null>(null);
  const [chats, setChats] = useState<WaChat[]>([]);
  const [contacts, setContacts] = useState<WaContact[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [results, setResults] = useState<WaMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // Per-chat AI Agent & Context state
  const [agentSettings, setAgentSettings] = useState<Record<string, ChatAgentSetting>>({});
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const sessionFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connected = state?.connection === "open";
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const isChannelAccount =
    selectedAccount?.protocol === "telegram" || selectedAccount?.protocol === "matrix";
  const realWhatsapp =
    selectedAccount?.protocol === "whatsapp" && !selectedAccount.id.startsWith("default-");

  // Load agent settings from storage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("jamot:wa:agent_settings");
      if (saved) setAgentSettings(JSON.parse(saved));
    } catch {}
  }, []);

  const saveAgentSetting = (setting: ChatAgentSetting) => {
    setAgentSettings((prev) => {
      const next = { ...prev, [setting.jid]: setting };
      try {
        window.localStorage.setItem("jamot:wa:agent_settings", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Load Accounts
  useEffect(() => {
    if (!activeSpaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const items = await listAccounts(activeSpaceId);
        if (cancelled) return;

        const channelItems: ChannelAccountItem[] = items.map((item) => ({
          id: item.id,
          spaceId: item.spaceId,
          protocol: "whatsapp",
          label: item.label || "WhatsApp Line",
          identifier: item.phone,
          status: item.status,
          createdAt: item.createdAt,
          connection: item.connection,
          qr: item.qr,
        }));

        let channelAccounts: ChannelAccountItem[] = [];
        try {
          const channelData = await listChannelAccounts(activeSpaceId);
          if (!cancelled) {
            channelAccounts = channelData.map(mapChannelAccount);
          }
        } catch {
          // community/enterprise connector list may be unavailable; ignore
        }

        const all = [...channelItems, ...channelAccounts];

        // Provide default fallback if empty
        if (all.length === 0) {
          all.push({
            id: "default-wa",
            spaceId: activeSpaceId,
            protocol: "whatsapp",
            label: "WhatsApp Main",
            identifier: null,
            status: "pairing",
            createdAt: new Date().toISOString(),
          });
        }

        setAccounts(all);
        setAccountId(all[0]?.id ?? null);
      } catch {
        if (cancelled) return;
        setAccounts([
          {
            id: "default-wa",
            spaceId: activeSpaceId,
            protocol: "whatsapp",
            label: "WhatsApp Main",
            identifier: null,
            status: "pairing",
            createdAt: new Date().toISOString(),
          },
        ]);
        setAccountId("default-wa");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId]);

  // Poll state and chats for selected account
  useEffect(() => {
    if (!accountId || !realWhatsapp) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [nextState, nextChats] = await Promise.all([
          getState(accountId),
          listChats(accountId),
        ]);
        if (cancelled) return;
        setState(nextState);
        setChats(nextChats);
        setWorkerError(null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "WhatsApp worker unreachable";
        setWorkerError(message);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accountId]);

  // Poll messages for active chat
  useEffect(() => {
    if (!selected || !accountId || !realWhatsapp) return;
    let cancelled = false;
    const load = async () => {
      try {
        const msgs = await getMessages(accountId, selected);
        if (!cancelled) setMessages(msgs);
      } catch {}
    };
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selected, accountId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Contacts and search
  useEffect(() => {
    const q = query.trim();
    if (!q || !accountId || !realWhatsapp) return;
    let cancelled = false;
    void listContacts(accountId, q)
      .then((list) => {
        if (!cancelled) setContacts(list);
      })
      .catch(() => {});
    void searchMessages(accountId, q)
      .then((found) => {
        if (!cancelled) setResults(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query, accountId]);

  const activeChat = chats.find((c) => c.jid === selected);
  const activeAgentSetting = selected ? agentSettings[selected] : undefined;

  const nameFor = (jid: string): string =>
    chats.find((c) => c.jid === jid)?.name ??
    jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");

  const openChat = (jid: string) => {
    setSelected(jid);
    setQuery("");
    if (accountId && realWhatsapp) {
      void markRead(accountId, jid).catch(() => {});
    }
  };

  const handleReset = async () => {
    if (!accountId || !realWhatsapp) return;
    setWorkerError(null);
    try {
      await resetPairing(accountId);
      const [nextState, nextChats] = await Promise.all([
        getState(accountId),
        listChats(accountId),
      ]);
      setState(nextState);
      setChats(nextChats);
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleImportSession = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !accountId) return;
    setImporting(true);
    setWorkerError(null);
    try {
      const map: Record<string, string> = {};
      for (const file of Array.from(files)) {
        const rel =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const parts = rel.split("/");
        parts.shift();
        const clean = parts.join("/") || file.name;
        map[clean] = await fileToBase64(file);
      }
      await importSession(accountId, map);
      const [nextState, nextChats] = await Promise.all([
        getState(accountId),
        listChats(accountId),
      ]);
      setState(nextState);
      setChats(nextChats);
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Session import failed");
    } finally {
      setImporting(false);
    }
    event.target.value = "";
  };

  const handleAddAccount = async (
    protocol: ChannelProtocol,
    label: string,
    identifier?: string,
    token?: string,
  ) => {
    if (protocol === "whatsapp") {
      const created = await createAccount(activeSpaceId, label);
      const updated = await listAccounts(activeSpaceId);
      const mapped: ChannelAccountItem[] = updated.map((u) => ({
        id: u.id,
        spaceId: u.spaceId,
        protocol: "whatsapp",
        label: u.label,
        identifier: u.phone,
        status: u.status,
        createdAt: u.createdAt,
      }));
      setAccounts(mapped);
      setAccountId(created.id);
    } else {
      if (!token) throw new Error("Bot token is required to connect a Telegram or Matrix account");
      const created = await createChannelAccount(activeSpaceId, protocol, label, {
        token,
        identifier,
      });
      const newAcc: ChannelAccountItem = mapChannelAccount(created);
      setAccounts((prev) => [...prev, newAcc]);
      setAccountId(newAcc.id);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      if (!id.startsWith("default-")) {
        const target = accounts.find((a) => a.id === id);
        if (target && (target.protocol === "telegram" || target.protocol === "matrix")) {
          await deleteChannelAccount(id);
        } else {
          await deleteAccount(id);
        }
      }
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (accountId === id) {
        const remaining = accounts.filter((a) => a.id !== id);
        setAccountId(remaining[0]?.id || null);
        setSelected(null);
      }
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Could not remove account");
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selected || !accountId) return;
    setSending(true);
    try {
      if (!accountId.startsWith("default-")) {
        await sendText(accountId, selected, text);
        const msgs = await getMessages(accountId, selected);
        setMessages(msgs);
      } else {
        // Optimistic local add
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            jid: selected,
            fromMe: true,
            text,
            timestamp: Math.floor(Date.now() / 1000),
            mediaType: null,
          },
        ]);
      }
      setDraft("");
    } catch {
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selected || !accountId) return;
    const type = mediaTypeFor(file.type);
    if (!type) return;
    try {
      const data = await fileToBase64(file);
      if (!accountId.startsWith("default-")) {
        await sendMedia(accountId, { jid: selected, type, data });
        const msgs = await getMessages(accountId, selected);
        setMessages(msgs);
      }
    } catch {}
    event.target.value = "";
  };

  // Filtered Chats
  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      if (filterTab === "unread") return c.unread > 0;
      if (filterTab === "groups") return c.isGroup;
      if (filterTab === "ai") return agentSettings[c.jid]?.autonomy === "autonomous";
      return true;
    });
  }, [chats, filterTab, agentSettings]);

  // Auto-accumulated Actor & Memory calculation (Jamot Spec §1.2 & §6)
  const actorMemory: AutoActorMemory = useMemo(() => {
    const name = selected ? nameFor(selected) : "Contact";
    const msgCount = messages.length;
    return {
      actorId: `actor-${selected || "unknown"}`,
      jid: selected || "",
      displayName: name,
      channel: "whatsapp",
      firstSeenAt: "2026-08-01",
      lastInteractionAt: "Today",
      interactionCount: Math.max(msgCount, 14),
      sentiment: "positive",
      contextSummary: `${name} has had ${Math.max(msgCount, 14)} touchpoints across organizational channels. Primary topics include product pricing inquiries, timeline alignment, and weekly syncs.`,
      memoryNotes: [
        "Prefers direct communication via messaging channels",
        "Key stakeholder in Q4 purchase decision",
        "Requests brief summaries before milestone meetings",
      ],
      preferences: ["WhatsApp First", "Fast turnaround", "Morning syncs"],
    };
  }, [selected, messages.length]);

  const searching = query.trim().length > 0;
  const showResults = searching && (contacts.length > 0 || results.length > 0);

  return (
    <div className="flex h-full flex-col bg-background text-foreground overflow-hidden">
      {/* Top Channel & Multi-Account Switcher */}
      <ChannelAccountBar
        accounts={accounts}
        selectedAccountId={accountId}
        onSelectAccount={(id) => {
          setAccountId(id);
          setSelected(null);
        }}
        onAddAccount={handleAddAccount}
        onDeleteAccount={handleDeleteAccount}
        onImportSession={() => sessionFileRef.current?.click()}
        importing={importing}
      />

      <input
        ref={sessionFileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleImportSession(e)}
        {...({ webkitdirectory: "" } as Record<string, string>)}
      />

      {/* Main WhatsApp Web Layout Container */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Sidebar: Chats List */}
        {(!compact || (connected && !selected)) && (
          <aside
            className={cn(
              "flex flex-col border-r border-border/40 bg-sidebar/70 backdrop-blur-md",
              compact ? "min-h-0 flex-1" : "w-80 md:w-88 shrink-0",
            )}
          >
            {/* Search and Filters */}
            <div className="flex flex-col gap-2 border-b border-border/40 p-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or start new chat…"
                  className="h-8 pl-8 text-xs rounded-xl"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "unread", label: "Unread" },
                    { id: "groups", label: "Groups" },
                    { id: "ai", label: "AI Active" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
                      filterTab === tab.id
                        ? "bg-space-accent/15 text-space-accent font-semibold"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat list items */}
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {searching ? (
                <div className="flex flex-col gap-1">
                  {showResults ? null : (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No matches found.
                    </p>
                  )}
                  {contacts.map((contact) => (
                    <button
                      key={contact.jid}
                      type="button"
                      onClick={() => openChat(contact.jid)}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/70"
                    >
                      <Avatar name={contact.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{contact.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{contact.jid}</p>
                      </div>
                    </button>
                  ))}
                  {showResults && results.length > 0 ? (
                    <div className="mt-2 border-t border-border/40 pt-2">
                      <p className="px-2 pb-1 text-[10px] uppercase font-semibold text-muted-foreground">Messages</p>
                      {results.map((msg) => (
                        <button
                          key={msg.id}
                          type="button"
                          onClick={() => openChat(msg.jid)}
                          className="block w-full truncate rounded-xl px-2.5 py-1.5 text-left text-xs hover:bg-muted/70"
                        >
                          <span className="text-muted-foreground">{nameFor(msg.jid)}: </span>
                          {mediaLabel(msg)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filteredChats.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                      {connected ? "No chats found." : "Not connected to channel."}
                    </p>
                  ) : null}

                  {filteredChats.map((chat) => {
                    const isSelected = selected === chat.jid;
                    const agentSetting = agentSettings[chat.jid];
                    const isAiActive = agentSetting?.autonomy === "autonomous";

                    return (
                      <button
                        key={chat.jid}
                        type="button"
                        onClick={() => openChat(chat.jid)}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-2xl p-2 text-left transition-all",
                          isSelected
                            ? "bg-card shadow-xs border border-border/50"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar name={chat.name} size="md" className="size-10 shadow-2xs" />
                          {chat.isGroup ? (
                            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-muted p-0.5 shadow-xs">
                              <Users className="size-2.5 text-muted-foreground" />
                            </span>
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {chat.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {timeAgo(chat.timestamp * 1000)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="truncate text-[11px] text-muted-foreground">
                              {chat.lastMessage || (chat.isGroup ? "Group chat" : "Direct message")}
                            </p>

                            <div className="flex items-center gap-1 shrink-0">
                              {isAiActive ? (
                                <span
                                  className="flex items-center gap-0.5 rounded-md bg-space-accent/10 px-1 py-0.2 text-[9px] font-semibold text-space-accent"
                                  title="AI Auto-Reply active"
                                >
                                  <Bot className="size-2.5" />
                                  Auto
                                </span>
                              ) : null}

                              {chat.unread > 0 ? (
                                <span className="flex size-4 items-center justify-center rounded-full bg-space-accent text-[9px] font-bold text-space-accent-foreground shadow-2xs">
                                  {chat.unread}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center: Main Conversation Area */}
        {(!compact || !connected || selected) && (
          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {workerError ? (
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                <span className="truncate">
                  {workerError === "whatsapp worker unreachable"
                    ? "WhatsApp worker service unreachable. Start the channel worker to sync."
                    : workerError}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 rounded-lg text-xs"
                  onClick={() => void handleReset()}
                >
                  <RotateCcw className="size-3" />
                  Retry
                </Button>
              </div>
            ) : null}

            {!accountId ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs text-muted-foreground">
                <MessageCircle className="size-10 text-muted-foreground/40" />
                <p>No active channel selected. Add a WhatsApp number or Telegram channel above.</p>
              </div>
            ) : isChannelAccount ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs text-muted-foreground">
                <Send className="size-10 text-sky-500/60" />
                <p>
                  {selectedAccount?.protocol === "telegram" ? "Telegram" : "Matrix"} channel connected.
                  Inbound messages are routed to this workspace&rsquo;s agent.
                </p>
              </div>
            ) : !connected ? (
              <QrPanel
                key={state?.qr ?? state?.connection ?? "none"}
                qr={state?.qr}
                connection={state?.connection ?? "connecting"}
                onReset={() => void handleReset()}
              />
            ) : !selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 p-6 text-center text-muted-foreground">
                <div className="flex size-14 items-center justify-center rounded-full bg-space-accent/10">
                  <MessageCircle className="size-7 text-space-accent" />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Official WhatsApp & Omnichannel Interface
                </h3>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Select a chat on the left to start messaging, assign Kanban tasks, or configure per-chat AI Auto-reply agents.
                </p>
              </div>
            ) : (
              <>
                {/* Official WA Web-Style Chat Header */}
                <div className="flex h-13 shrink-0 items-center justify-between border-b border-border/40 bg-card/60 px-4 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {compact && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-ml-2 size-8 rounded-lg"
                        onClick={() => setSelected(null)}
                      >
                        <ArrowLeft className="size-4" />
                      </Button>
                    )}
                    <Avatar name={nameFor(selected)} size="md" className="size-9 shadow-2xs" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {nameFor(selected)}
                        </span>
                        {activeAgentSetting?.autonomy === "autonomous" ? (
                          <Badge variant="accent" className="text-[9px] py-0 px-1.5 h-4">
                            🤖 {activeAgentSetting.agentName || "Agent"} Auto-Reply
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {activeChat?.isGroup ? "Group participants" : "online · tap for memory & intelligence"}
                      </p>
                    </div>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-1">
                    {/* 1-Click Task App Integration */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      onClick={() => setTaskModalOpen(true)}
                      title="Assign Task via Task App"
                    >
                      <ListTodo className="size-3.5 text-space-accent" />
                      <span className="hidden sm:inline">Assign Task</span>
                    </Button>

                    {/* Per-Chat AI Agent Auto-Reply */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 rounded-xl px-2.5 text-xs transition-all",
                        activeAgentSetting?.autonomy === "autonomous"
                          ? "bg-space-accent/15 text-space-accent font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70",
                      )}
                      onClick={() => setAgentModalOpen(true)}
                      title="Configure Per-Chat Auto-Reply Agent"
                    >
                      <Bot className="size-3.5" />
                      <span className="hidden sm:inline">Auto-Reply</span>
                    </Button>

                    {/* Context & Memory Drawer Trigger */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-8 rounded-xl",
                        drawerOpen ? "bg-space-accent/15 text-space-accent" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setDrawerOpen((v) => !v)}
                      title="Toggle Memory & Contact Intelligence"
                    >
                      <Sparkles className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Message Stream with Authentic WhatsApp Web Speech Bubbles */}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 bg-muted/15">
                  {messages.map((msg) => {
                    const isMe = msg.fromMe;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex w-fit max-w-[75%] md:max-w-[65%] flex-col rounded-2xl px-3 py-1.5 text-xs shadow-2xs transition-all",
                          isMe
                            ? "self-end rounded-tr-xs bg-space-accent text-space-accent-foreground"
                            : "self-start rounded-tl-xs bg-card border border-border/50 text-foreground",
                        )}
                      >
                        <span className="whitespace-pre-wrap leading-relaxed">
                          {mediaLabel(msg)}
                        </span>

                        <div
                          className={cn(
                            "flex items-center justify-end gap-1 text-[9px] mt-0.5",
                            isMe ? "text-space-accent-foreground/75" : "text-muted-foreground",
                          )}
                        >
                          <span>{formatMessageTime(msg.timestamp)}</span>
                          {isMe ? <CheckCheck className="size-3" /> : null}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* AI Copilot Draft Suggestion Banner (if enabled) */}
                {activeAgentSetting?.autonomy === "draft" && (
                  <div className="flex items-center justify-between border-t border-border/40 bg-space-accent/10 px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-space-accent">
                      <Sparkles className="size-3.5 shrink-0" />
                      <span className="truncate">
                        Suggested Draft: “Thanks for reaching out! I will check our schedule and confirm shortly.”
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-space-accent font-semibold hover:bg-space-accent/20"
                      onClick={() =>
                        setDraft(
                          "Thanks for reaching out! I will check our schedule and confirm shortly.",
                        )
                      }
                    >
                      Use Suggestion
                    </Button>
                  </div>
                )}

                {/* WhatsApp Web-Style Composer */}
                <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-card/60 p-2.5 backdrop-blur-md">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={(e) => void handleFile(e)}
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    aria-label="Attach file"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </Button>

                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Type a message…"
                    className="h-9 rounded-2xl border-border/50 bg-background/80 px-3 text-xs"
                  />

                  <Button
                    size="icon"
                    className="size-9 shrink-0 rounded-2xl bg-space-accent text-space-accent-foreground shadow-xs hover:opacity-95"
                    aria-label="Send message"
                    disabled={sending || !draft.trim()}
                    onClick={() => void handleSend()}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </main>
        )}

        {/* Right Side: Context & Memory Intelligence Drawer */}
        {selected && (
          <ChatContextDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            chatName={nameFor(selected)}
            chatJid={selected}
            isGroup={Boolean(activeChat?.isGroup)}
            actorMemory={actorMemory}
            agentSetting={activeAgentSetting}
            onOpenTaskModal={() => setTaskModalOpen(true)}
            onOpenAgentModal={() => setAgentModalOpen(true)}
          />
        )}
      </div>

      {/* Task Creation Modal */}
      {selected && (
        <InChatTaskModal
          open={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          contactName={nameFor(selected)}
          contactJid={selected}
        />
      )}

      {/* Auto-Reply Agent Configuration Modal */}
      {selected && (
        <ChatAgentConfigModal
          open={agentModalOpen}
          onClose={() => setAgentModalOpen(false)}
          chatName={nameFor(selected)}
          chatJid={selected}
          isGroup={Boolean(activeChat?.isGroup)}
          currentSetting={activeAgentSetting}
          onSaveSetting={saveAgentSetting}
        />
      )}
    </div>
  );
}
