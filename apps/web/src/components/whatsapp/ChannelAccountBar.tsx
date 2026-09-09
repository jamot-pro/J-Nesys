"use client";

import { useState } from "react";
import {
  Check,
  Globe,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChannelAccountItem, ChannelProtocol } from "./channel-types";

interface ChannelAccountBarProps {
  accounts: ChannelAccountItem[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onAddAccount: (
    protocol: ChannelProtocol,
    label: string,
    identifier?: string,
    token?: string,
  ) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onImportSession?: () => void;
  importing?: boolean;
}

export function ChannelAccountBar({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
  onDeleteAccount,
  onImportSession,
  importing = false,
}: ChannelAccountBarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [protocol, setProtocol] = useState<ChannelProtocol>("whatsapp");
  const [label, setLabel] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleCreate = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onAddAccount(
        protocol,
        label.trim(),
        identifier.trim() || undefined,
        token.trim() || undefined,
      );
      setModalOpen(false);
      setLabel("");
      setIdentifier("");
      setToken("");
    } finally {
      setBusy(false);
    }
  };

  const getProtocolIcon = (proto: ChannelProtocol) => {
    switch (proto) {
      case "whatsapp":
        return <MessageCircle className="size-3.5 text-emerald-500" />;
      case "telegram":
        return <Send className="size-3.5 text-sky-500" />;
      case "matrix":
        return <Globe className="size-3.5 text-violet-500" />;
    }
  };

  return (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-sidebar/50 px-3 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {accounts.map((acc) => {
            const active = acc.id === selectedAccountId;
            const isConnected = acc.status === "connected";
            const isPairing = acc.status === "pairing";

            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => onSelectAccount(acc.id)}
                className={cn(
                  "group relative flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  active
                    ? "bg-card text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {getProtocolIcon(acc.protocol)}
                <span className="max-w-[120px] truncate">{acc.label}</span>
                
                {/* Status indicator dot */}
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isConnected
                      ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                      : isPairing
                        ? "bg-amber-500 animate-pulse"
                        : "bg-muted-foreground/40",
                  )}
                  title={`Status: ${acc.status}`}
                />

                {/* Remove button on hover if multiple accounts */}
                {accounts.length > 1 ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteAccount(acc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-rose-500"
                    title="Remove channel"
                  >
                    <Trash2 className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-xl px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setModalOpen(true)}
            title="Connect another WhatsApp number, Telegram, or Matrix"
          >
            <Plus className="size-3.5 text-space-accent" />
            <span className="hidden sm:inline">Add Number / Channel</span>
          </Button>
        </div>

        {selectedAccount && selectedAccount.protocol === "whatsapp" && onImportSession ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              onClick={onImportSession}
              disabled={importing}
              title="Import paired WhatsApp session folder"
            >
              {importing ? (
                <Loader2 className="size-3.5 animate-spin text-space-accent" />
              ) : (
                <Upload className="size-3.5" />
              )}
              <span className="hidden md:inline">{importing ? "Importing…" : "Import Session"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Add Account Modal */}
      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="glass-card glass-border relative w-full max-w-md overflow-hidden rounded-3xl p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-space-accent" />
                  <h3 className="font-display text-sm font-semibold">Connect New Channel</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => setModalOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {/* Protocol selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Protocol
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setProtocol("whatsapp")}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs transition-all",
                        protocol === "whatsapp"
                          ? "border-space-accent bg-space-accent/10 font-semibold text-space-accent"
                          : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <MessageCircle className="size-5 text-emerald-500" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtocol("telegram")}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs transition-all",
                        protocol === "telegram"
                          ? "border-space-accent bg-space-accent/10 font-semibold text-space-accent"
                          : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <Send className="size-5 text-sky-500" />
                      <span>Telegram</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProtocol("matrix")}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs transition-all",
                        protocol === "matrix"
                          ? "border-space-accent bg-space-accent/10 font-semibold text-space-accent"
                          : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <Globe className="size-5 text-violet-500" />
                      <span>Matrix</span>
                    </button>
                  </div>
                </div>

                {/* Account Label */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Account Label / Department
                  </label>
                  <Input
                    placeholder={
                      protocol === "whatsapp"
                        ? "e.g. Sales Team Line, Support (+1 555-0192)"
                        : protocol === "telegram"
                          ? "e.g. Alerts Bot (@JamotAlerts)"
                          : "e.g. Federated Org Room"
                    }
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>

                {/* Optional Phone / Handle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {protocol === "whatsapp"
                      ? "Phone Number (Optional identifier)"
                      : protocol === "telegram"
                        ? "Bot Username (e.g. @JamotAlertsBot, optional)"
                        : "Matrix User ID (e.g. @user:matrix.org)"}
                  </label>
                  <Input
                    placeholder={
                      protocol === "whatsapp"
                        ? "+1 (555) 019-2834"
                        : protocol === "telegram"
                          ? "@JamotAlertsBot"
                          : "@user:matrix.org"
                    }
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>

                {protocol === "telegram" || protocol === "matrix" ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {protocol === "telegram"
                        ? "Bot Token (required)"
                        : "Access Token (required)"}
                    </label>
                    <Input
                      type="password"
                      placeholder={
                        protocol === "telegram"
                          ? "bot123456:ABC-DEF..."
                          : "syt_xxx..."
                      }
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <QrCode className="size-4 shrink-0 text-space-accent mt-0.5" />
                  <span>
                    {protocol === "whatsapp"
                      ? "After creating, you will get a pairing QR code to scan directly with WhatsApp Linked Devices."
                      : "The channel adapter connects directly through the protocol stack and starts syncing inbound events."}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                  <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-space-accent text-space-accent-foreground hover:opacity-90 rounded-xl"
                    disabled={!label.trim() || busy}
                    onClick={() => void handleCreate()}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Connect Channel
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
