/**
 * Compatibility shim. The client itself now lives in `@jamot/client` so every
 * web surface (this cockpit, the per-org consoles in apps/console) shares one
 * transport instead of copying it.
 *
 * The base URL is read from the environment rather than imported from
 * `auth-context`: that module is itself a consumer of this one, and an eager
 * cross-import would put `API_URL`'s const binding in its TDZ on whichever
 * module loaded first. The default matches auth-context's exactly.
 */
import { configureApiClient } from "@jamot/client/config";

configureApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export * from "@jamot/client";
