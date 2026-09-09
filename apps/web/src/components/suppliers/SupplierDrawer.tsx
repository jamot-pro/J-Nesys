"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SupplierProfile } from "./SupplierProfile";
import type { SupplierView } from "./types";

export function SupplierDrawer({
  view,
  onClose,
}: {
  view: SupplierView;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.aside
      key={view.supplier.id}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="truncate text-sm font-medium">{view.actorName}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Close supplier profile"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SupplierProfile view={view} />
      </div>
    </motion.aside>
  );
}
