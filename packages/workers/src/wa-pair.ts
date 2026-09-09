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
 * Usage:
 *   pnpm --filter @jamot/workers exec tsx src/wa-pair.ts [--out <dir>] [--png <file>] [--timeout <sec>] [--reset]
 */

interface CliArgs {
  out: string;
  png: string;
  timeoutSec: number;
  reset: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    out: ".wa-pair",
    png: "wa-qr.png",
    timeoutSec: 180,
    reset: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--png") args.png = argv[++i] ?? args.png;
    else if (a === "--timeout") args.timeoutSec = Number(argv[++i] ?? 180);
    else if (a === "--reset") args.reset = true;
    else if (a === "--help") {
      console.log(
        "Usage: wa-pair [--out <dir>] [--png <file>] [--timeout <sec>] [--reset]",
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
  console.log(
    "\n[wa-pair] upload this directory in the web app (WhatsApp → Import session), or POST the base64 files to /api/wa/accounts/:id/session.",
  );
}

void main();
