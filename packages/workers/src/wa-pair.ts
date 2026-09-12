import { createInterface } from "node:readline";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { createWhatsAppAdapter } from "@jamot/core/channels";

/**
 * Local WhatsApp pairing helper.
 *
 * WhatsApp refuses the *new-pairing* handshake from datacenter IPs (Render),
 * but accepts it from residential IPs. Run this on a machine on your home /
 * office network to pair a session, then import the produced directory into
 * the deployed channel worker:
 *
 *   POST /api/wa/accounts/:id/session
 *   { "files": { "creds.json": "<base64>", ... } }
 *
 * Give it --api and --email and it does that last step itself: it signs in,
 * finds or creates the account, uploads the session and waits until the server
 * reports the connection open. The password is never a CLI argument — it is
 * read from JAMOT_PASSWORD or prompted for — so it stays out of shell history.
 *
 * Usage:
 *   pnpm --filter @jamot/workers exec tsx src/wa-pair.ts [--out <dir>] [--png <file>] [--timeout <sec>] [--reset]
 *     [--api <url>] [--email <address>] [--space <id>] [--label <name>] [--account <id>]
 */

interface CliArgs {
  out: string;
  png: string;
  timeoutSec: number;
  reset: boolean;
  api?: string;
  email?: string;
  space?: string;
  label: string;
  account?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    out: ".wa-pair",
    png: "wa-qr.png",
    timeoutSec: 180,
    reset: false,
    label: "Paired locally",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--png") args.png = argv[++i] ?? args.png;
    else if (a === "--timeout") args.timeoutSec = Number(argv[++i] ?? 180);
    else if (a === "--reset") args.reset = true;
    else if (a === "--api") args.api = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--space") args.space = argv[++i];
    else if (a === "--label") args.label = argv[++i] ?? args.label;
    else if (a === "--account") args.account = argv[++i];
    else if (a === "--help") {
      console.log(
        "Usage: wa-pair [--out <dir>] [--png <file>] [--timeout <sec>] [--reset]\n" +
          "               [--api <url>] [--email <address>] [--space <id>] [--label <name>] [--account <id>]\n\n" +
          "Without --api the session is only written to disk. With it, the session\n" +
          "is uploaded to that API and the account is polled until it connects.\n" +
          "The password comes from JAMOT_PASSWORD, or is prompted for.",
      );
      process.exit(0);
    }
  }
  return args;
}

function listSessionFiles(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) entries.push(...listSessionFiles(full));
    else entries.push(full);
  }
  return entries.sort();
}


/** Reads a secret from stdin without echoing it back to the terminal. */
async function promptSecret(question: string): Promise<string> {
  const input = process.stdin;
  const rl = createInterface({ input, output: process.stdout, terminal: true });
  const muted = { value: false };
  const write = process.stdout.write.bind(process.stdout);
  (process.stdout as unknown as { write: typeof write }).write = ((chunk: string, ...rest: unknown[]) =>
    muted.value ? true : write(chunk, ...(rest as []))) as typeof write;
  try {
    write(question);
    muted.value = true;
    const answer = await new Promise<string>((resolve) => rl.question("", resolve));
    muted.value = false;
    write("\n");
    return answer;
  } finally {
    muted.value = false;
    (process.stdout as unknown as { write: typeof write }).write = write;
    rl.close();
  }
}

interface ApiSession {
  base: string;
  cookie: string;
}

async function apiFetch(
  session: ApiSession,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  return fetch(new URL(path, session.base), {
    method: init?.method ?? "GET",
    headers: {
      cookie: session.cookie,
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function signIn(base: string, email: string, password: string): Promise<ApiSession> {
  const res = await fetch(new URL("/api/auth/login", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`sign-in failed (${res.status}) — check the email and password`);
  }
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("sign-in returned no session cookie");
  return { base, cookie };
}

/**
 * Uploads the paired session to the API and waits for the server to report the
 * connection open. Resuming an existing session is a different handshake from
 * pairing a new one, and WhatsApp accepts it from a datacenter IP — which is
 * the whole reason this indirection exists.
 */
async function uploadSession(args: CliArgs, dir: string, files: string[]): Promise<void> {
  const base = args.api!;
  const email = args.email;
  if (!email) throw new Error("--api needs --email as well");
  const password =
    process.env.JAMOT_PASSWORD ?? (await promptSecret(`Password for ${email}: `));
  if (!password) throw new Error("no password given");

  console.log(`\n[wa-pair] signing in to ${base}…`);
  const session = await signIn(base, email, password);

  let accountId = args.account;
  if (!accountId) {
    let spaceId = args.space;
    if (!spaceId) {
      const me = await apiFetch(session, "/api/auth/me");
      if (!me.ok) throw new Error(`could not read the signed-in actor (${me.status})`);
      spaceId = ((await me.json()) as { actor?: { personalSpaceId?: string } }).actor
        ?.personalSpaceId;
      if (!spaceId) throw new Error("no space to attach the account to — pass --space");
    }
    const listed = await apiFetch(
      session,
      `/api/wa/accounts?spaceId=${encodeURIComponent(spaceId)}`,
    );
    const existing = listed.ok
      ? ((await listed.json()) as { items?: { id: string; label: string }[] }).items ?? []
      : [];
    const match = existing.find((a) => a.label === args.label);
    if (match) {
      accountId = match.id;
      console.log(`[wa-pair] reusing account "${args.label}" (${accountId})`);
    } else {
      const created = await apiFetch(session, "/api/wa/accounts", {
        method: "POST",
        body: { spaceId, label: args.label },
      });
      if (!created.ok) {
        throw new Error(`could not create the account (${created.status}): ${await created.text()}`);
      }
      accountId = ((await created.json()) as { id: string }).id;
      console.log(`[wa-pair] created account "${args.label}" (${accountId})`);
    }
  }

  const payload: Record<string, string> = {};
  for (const full of files) {
    const name = full.slice(dir.length).replace(/^[/\\]/, "");
    payload[name] = readFileSync(full).toString("base64");
  }

  console.log(`[wa-pair] uploading ${files.length} session files…`);
  const imported = await apiFetch(session, `/api/wa/accounts/${accountId}/session`, {
    method: "POST",
    body: { files: payload },
  });
  if (!imported.ok) {
    throw new Error(`import failed (${imported.status}): ${await imported.text()}`);
  }

  console.log("[wa-pair] imported — waiting for the server to connect…");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const state = await apiFetch(session, `/api/wa/accounts/${accountId}/state`);
    if (state.ok) {
      const body = (await state.json()) as { connection?: string; status?: string };
      const status = body.connection ?? body.status;
      if (status === "open") {
        console.log(`\n[wa-pair] connected. Account ${accountId} is live on the server.`);
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(
    `\n[wa-pair] uploaded, but the server has not reported "open" within 90s.\n` +
      `           Check the account in Settings → Channels; it may still be resuming.`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.reset) rmSync(args.out, { recursive: true, force: true });

  const adapter = createWhatsAppAdapter({
    id: "wa-pair",
    sessionDir: args.out,
    syncFullHistory: false,
  });

  const started = Date.now();
  const deadline = started + args.timeoutSec * 1000;
  let lastQr = "";
  let sawQr = false;
  let sawOpen = false;

  while (Date.now() < deadline) {
    const state = adapter.getState();
    if (state.qr && state.qr !== lastQr) {
      sawQr = true;
      lastQr = state.qr;
      try {
        writeFileSync(args.png, await QRCode.toBuffer(state.qr, { width: 320 }));
        console.log(`\n[wa-pair] QR saved to ${args.png} — scan with WhatsApp → Settings → Linked devices`);
        if (process.stdout.isTTY) {
          console.log(await QRCode.toString(state.qr, { type: "terminal", small: true }));
        }
      } catch (err) {
        console.log(`[wa-pair] could not render QR: ${(err as Error).message}`);
        console.log(`[wa-pair] raw: ${state.qr}`);
      }
    }
    if (state.connection === "open") {
      sawOpen = true;
      // Wait until WhatsApp fully registers the device (creds.registered=true)
      // and the auth state is flushed to disk. If we disconnect too early, the
      // exported session carries registered=false and WA rejects resume (428).
      const regDeadline = Date.now() + 15000;
      while (Date.now() < regDeadline) {
        try {
          const creds = JSON.parse(
            readFileSync(join(args.out, "creds.json"), "utf8"),
          ) as { registered?: boolean };
          if (creds.registered) break;
        } catch {
          // creds.json may not be flushed yet; keep waiting
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      break;
    }
    if (state.connection === "close" && !sawQr) {
      console.log(
        "[wa-pair] connection closed before a QR was produced — if this machine is on a datacenter/cloud IP, WhatsApp may be refusing the pairing handshake. Run this from a residential network.",
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!sawOpen) {
    await adapter.disconnect();
    console.log(
      sawQr
        ? `\n[wa-pair] timeout — QR expired before it was scanned. Run again (session dir kept: ${args.out}).`
        : "\n[wa-pair] timeout — no QR was ever produced.",
    );
    process.exit(1);
  }

  let phone = "unknown";
  try {
    const creds = JSON.parse(readFileSync(join(args.out, "creds.json"), "utf8")) as {
      me?: { id?: string };
    };
    phone = creds.me?.id?.replace(/@s\.whatsapp\.net$/, "") ?? "unknown";
  } catch {
    // creds.json not readable yet; ignore
  }

  const files = listSessionFiles(args.out);
  await adapter.disconnect();

  console.log(`\n[wa-pair] paired with WhatsApp number: +${phone}`);
  console.log(`[wa-pair] session directory ready: ${args.out}`);
  console.log(`[wa-pair] files to import (${files.length}):`);
  for (const f of files) console.log(`  ${f.replace(args.out + "/", "")}`);
  if (args.api) {
    await uploadSession(args, args.out, files);
    return;
  }

  console.log(
    "\n[wa-pair] upload this directory in the web app (Settings → Channels → Import a paired session),\n" +
      "          or re-run with --api <url> --email <address> to have this script do it.",
  );
}

void main();
