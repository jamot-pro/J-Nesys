import { URL } from "node:url";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRIVATE_IPV4_CIDRS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "169.254.0.0/16",
];

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split(".").map((part) => Number(part));
  return (((a ?? 0) << 24) | ((b ?? 0) << 16) | ((c ?? 0) << 8) | (d ?? 0)) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, bitsText] = cidr.split("/");
  const bits = Number(bitsText);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network ?? "0.0.0.0") & mask);
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_CIDRS.some((cidr) => ipv4InCidr(ip, cidr));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    return isIP(mapped) === 4 && isPrivateIpv4(mapped);
  }
  // link-local fe80::/10
  if (
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  ) {
    return true;
  }
  // unique-local fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

// Best-effort SSRF guard: scheme and literal-IP checks are synchronous, but a
// hostname that resolves to a private address (DNS rebinding) is only detected
// asynchronously and cannot be rejected here — treat this as a heuristic.
export function assertSafeMcpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`unsafe MCP URL: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`unsafe MCP URL scheme: ${parsed.protocol} (http/https only)`);
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`unsafe MCP URL host: ${hostname} (loopback)`);
  }

  const version = isIP(hostname);
  if (version === 4 && isPrivateIpv4(hostname)) {
    throw new Error(`unsafe MCP URL host: ${hostname} (private IPv4)`);
  }
  if (version === 6 && isPrivateIpv6(hostname)) {
    throw new Error(`unsafe MCP URL host: ${hostname} (private IPv6)`);
  }

  if (version === 0) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("dns lookup timeout")), 2000),
    );
    Promise.race([lookup(hostname, { all: true }), timeout])
      .then((addresses) => {
        const privateAddr = addresses.find(
          ({ address }) =>
            (isIP(address) === 4 && isPrivateIpv4(address)) ||
            (isIP(address) === 6 && isPrivateIpv6(address)),
        );
        if (privateAddr) {
          throw new Error(
            `unsafe MCP URL host: ${hostname} resolved to private address ${privateAddr.address}`,
          );
        }
      })
      .catch(() => {
        // unresolved hosts are treated as safe; best-effort only
      });
  }
}
