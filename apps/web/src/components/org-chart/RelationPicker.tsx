"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_RELATIONS_FROM,
  RELATION_LABEL,
} from "./org-data";
import type { OrgEdgeRelation, OrgNode } from "@/lib/api-client";

export interface RelationPick {
  source: string;
  target: string;
}

export function RelationPicker({
  source,
  target,
  nodes,
  onConfirm,
  onCancel,
}: {
  source: string;
  target: string;
  nodes: OrgNode[];
  onConfirm: (relation: OrgEdgeRelation) => void;
  onCancel: () => void;
}) {
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  const allowed: OrgEdgeRelation[] =
    (sourceNode && ALLOWED_RELATIONS_FROM[sourceNode.kind]) || [];
  const [relation, setRelation] = useState<OrgEdgeRelation | null>(
    allowed[0] ?? null,
  );

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
          className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <div className="flex items-center gap-2">
            <Link2 className="size-5 text-space-accent" />
            <h2 className="font-display text-base font-semibold">New connection</h2>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="truncate font-medium">
              {sourceNode?.name ?? source}
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">
              {targetNode?.name ?? target}
            </span>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Relation
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {allowed.map((rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() => setRelation(rel)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                    (relation === rel
                      ? "border-space-accent bg-space-accent/10 text-space-accent"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted")
                  }
                >
                  {RELATION_LABEL[rel]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              disabled={!relation}
              onClick={() => relation && onConfirm(relation)}
            >
              Connect
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}