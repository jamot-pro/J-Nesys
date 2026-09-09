import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { createWhatsAppAdapter } from "@jamot/core/channels";

const PROXY = process.env.WHATSAPP_PROXY_URL ?? "http://acbd4998fcfce5f6fa42__cr.id:95754e2975501430@74.81.81.81:10000";
const OUT = process.argv[2] ?? "/tmp/wa-proxy-pair";
const PNG = process.argv[3] ?? "/tmp/wa-proxy-qr.png";
const DEADLINE_MS = Number(process.argv[4] ?? 300000);

mkdirSync(OUT, { recursive: true });
const adapter = createWhatsAppAdapter({
  id: "proxy-pair",
  sessionDir: OUT,
  syncFullHistory: false,
  proxyUrl: PROXY,
});

const t0 = Date.now();
let lastQr = "";
let sawOpen = false;
let sawReg = false;

const iv = setInterval(async () => {
  const s = adapter.getState();
  if (s.qr && s.qr !== lastQr) {
    lastQr = s.qr;
    try {
      await QRCode.toFile(PNG, s.qr, { width: 320 });
      console.log(`[proxy-pair] QR refreshed -> ${PNG} (scan within ~60s)`);
    } catch (e) {
      console.log(`[proxy-pair] QR render err: ${(e as Error).message}`);
    }
  }
  if (s.connection === "open" && !sawOpen) {
    sawOpen = true;
    console.log("[proxy-pair] connection OPEN");
    try {
      const creds = JSON.parse(
        readFileSync(join(OUT, "creds.json"), "utf8"),
      ) as { registered?: boolean };
      sawReg = Boolean(creds.registered);
      console.log(`[proxy-pair] creds.registered = ${creds.registered}`);
    } catch {
      console.log("[proxy-pair] creds not readable yet");
    }
  }
  if (Date.now() - t0 > DEADLINE_MS) {
    clearInterval(iv);
    console.log(`[proxy-pair] FINAL open=${sawOpen} registered=${sawReg}`);
    await adapter.disconnect();
    process.exit(sawOpen && sawReg ? 0 : 1);
  }
}, 1500);
