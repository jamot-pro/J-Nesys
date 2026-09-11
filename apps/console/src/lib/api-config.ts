import { configureApiClient } from "@jamot/client/config";

/**
 * Configures @jamot/client once, for both server and browser bundles.
 *
 * Kept free of `next/headers` so client components can import it too —
 * lib/org.ts is server-only and cannot serve that purpose.
 */
configureApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export {};
