"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChangeRequest } from "./org-data";

export function ChangeProposal({
  proposal,
  onConfirm,
  onCancel,
}: {
  proposal: ChangeRequest;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <motion.div
        className="absolute inset-0 z-20 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-space-accent" />
            <h2 className="font-display text-base font-semibold">Change proposal</h2>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Moving a role changes who it reports to — and the authority flow of the chart. This
            change won&apos;t apply until you confirm.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="truncate font-medium">{proposal.nodeLabel}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{proposal.newParentLabel}</span>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>Confirm</Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
