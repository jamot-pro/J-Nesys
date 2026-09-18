"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, Truck, UserPlus } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { DirectoryToolbar } from "@/components/directory/DirectoryToolbar";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import {
  getOrganizations,
  listActors,
  listSuppliers,
} from "@/lib/api-client";

import { QuickAddSupplier } from "./QuickAddSupplier";
import { SupplierDrawer } from "./SupplierDrawer";
import { SuppliersTable } from "./SuppliersTable";
import { buildSupplierViews } from "./types";

export function SuppliersWorkspace() {
  const { space } = useAppShell();
  const orgId = space.kind === "organization" ? space.organizationId : undefined;

  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof listSuppliers>>>([]);
  const [actors, setActors] = useState<Awaited<ReturnType<typeof listActors>>>([]);
  const [organizations, setOrganizations] = useState<Awaited<ReturnType<typeof getOrganizations>>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [suppliers, actors, organizations] = await Promise.all([
        listSuppliers(),
        listActors(),
        getOrganizations(),
      ]);
      setSuppliers(suppliers);
      setActors(actors);
      setOrganizations(organizations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSuppliers(), listActors(), getOrganizations()])
      .then(([suppliers, actors, organizations]) => {
        if (cancelled) return;
        setSuppliers(suppliers);
        setActors(actors);
        setOrganizations(organizations);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => buildSupplierViews({ suppliers, actors, organizations }),
    [suppliers, actors, organizations],
  );

  const byId = useMemo(() => new Map(rows.map((row) => [row.supplier.id, row])), [rows]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) =>
      [
        row.actorName,
        row.orgName ?? "",
        row.supplier.onboardingStatus,
        row.supplier.defaultCurrency,
        row.supplier.terms ?? "",
      ].some((value) => value.toLowerCase().includes(trimmed)),
    );
  }, [rows, query]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <DirectoryToolbar
        placeholder="Search suppliers… try name, organization, status"
        query={query}
        loading={false}
        onQueryChange={setQuery}
        onSubmit={() => undefined}
        onClear={() => setQuery("")}
        actionLabel="Add supplier"
        actionIcon={<UserPlus className="size-3.5" />}
        onAction={() => setAdding(true)}
      />

      <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="flex min-h-0 flex-1">
            <EmptyList
              icon={Loader2}
              title="Loading suppliers…"
              description="Fetching the supplier network."
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex min-h-0 flex-1">
            {rows.length === 0 ? (
              <EmptyList
                icon={Truck}
                title="No suppliers yet"
                description="Add a supplier from the chat, or use the button above to register one."
              />
            ) : (
              <EmptyList
                icon={Search}
                title="No suppliers match your search"
                description={`“${query}” didn’t match anyone in the supplier network.`}
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <SuppliersTable rows={visible} onOpen={setSelectedId} />
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected ? (
          <SupplierDrawer view={selected} onClose={() => setSelectedId(null)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {adding ? (
          <>
            <motion.div
              className="absolute inset-0 z-20 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAdding(false)}
            />
            <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-4">
              <motion.div
                className="my-auto w-full max-w-md"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "tween", duration: 0.15 }}
              >
                <QuickAddSupplier
                  actors={actors}
                  organizations={organizations}
                  orgId={orgId}
                  onAdded={reload}
                  onDone={() => setAdding(false)}
                />
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
