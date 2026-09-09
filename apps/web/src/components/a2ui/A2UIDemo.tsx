"use client";

import { useEffect, useRef, useState } from "react";
import {
  A2UIProvider,
  A2UIRenderer,
  useA2UI,
} from "@copilotkit/a2ui-renderer";
import { catalog, theme } from "./a2ui-catalog";

const DEMO_SURFACE_ID = "demo";
const CATALOG_ID = "copilotkit://custom-catalog";

const suppliers = [
  { name: "ACME", price: 42000, days: 5, score: 94 },
  { name: "BuildCo", price: 38000, days: 8, score: 88 },
  { name: "XYZ", price: 45000, days: 4, score: 97 },
];

const demoMessages: Array<Record<string, unknown>> = [
  {
    version: "v0.9",
    createSurface: { surfaceId: DEMO_SURFACE_ID, catalogId: CATALOG_ID },
  },
  {
    version: "v0.9",
    updateDataModel: {
      surfaceId: DEMO_SURFACE_ID,
      path: "/suppliers",
      value: suppliers,
    },
  },
  {
    version: "v0.9",
    updateComponents: {
      surfaceId: DEMO_SURFACE_ID,
      components: [{ component: "SupplierCard", id: "root", suppliers }],
    },
  },
];

function DemoSurface() {
  const { processMessages, getSurface, version } = useA2UI();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    processMessages(demoMessages);
  }, [processMessages]);

  const surface = getSurface(DEMO_SURFACE_ID);
  const dataModel = surface?.dataModel?.get("/");

  return (
    <div className="space-y-3">
      <A2UIRenderer surfaceId={DEMO_SURFACE_ID} />

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">A2UI demo</span> · surface
        “demo” · version {version}
        {dataModel !== undefined && dataModel !== null ? (
          <pre className="mt-2 overflow-x-auto rounded bg-card p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {JSON.stringify(dataModel, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

export function A2UIDemo() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <A2UIProvider
        catalog={catalog}
        theme={theme}
        onAction={(message) => {
          setLastAction(message.userAction?.name ?? "unknown");
        }}
      >
        <DemoSurface />
      </A2UIProvider>

      {lastAction !== null ? (
        <div className="rounded-md border border-border bg-card p-2 text-xs text-muted-foreground">
          Last action:{" "}
          <span className="font-medium text-foreground">{lastAction}</span>
        </div>
      ) : null}
    </div>
  );
}
