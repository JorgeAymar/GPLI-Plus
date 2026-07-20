const PRIVATE_IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateIPv4(ipv4: string): boolean {
  const match = ipv4.match(PRIVATE_IPV4_PATTERN);
  if (!match) return false;
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first === 0) return true; // 0.0.0.0/8 "this network"
  if (first === 10) return true; // 10.0.0.0/8
  if (first === 127) return true; // 127.0.0.0/8 loopback
  if (first === 169 && second === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata, 169.254.169.254)
  if (first === 172 && second >= 16 && second <= 31) return true; // 172.16.0.0/12
  if (first === 192 && second === 168) return true; // 192.168.0.0/16
  return false;
}

/**
 * Anti-SSRF guard for any user-supplied URL fetched server-side (webhooks,
 * RSS feeds). Rejects non-http(s) schemes and private/loopback/link-local
 * hostnames - IPv4 ranges, IPv6 loopback/link-local/unique-local forms, and
 * IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`) that would otherwise sail
 * through an IPv4-only check unnoticed (originally this app only checked the
 * two literal strings "::1"/"[::1]", missing every other private IPv6
 * range). Not exhaustive DNS-rebinding protection - a hostname that
 * resolves to a private IP only at fetch time, after passing this
 * string-level check, would still get through - stops the obvious cases
 * with plain parsing, no extra dependency needed for this.
 */
export function isSafeExternalUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  let hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost") return false;

  // URL.hostname keeps the brackets on a literal IPv6 host, e.g. "[::1]".
  if (hostname.startsWith("[") && hostname.endsWith("]")) hostname = hostname.slice(1, -1);

  if (isPrivateIPv4(hostname)) return false;

  if (hostname.includes(":")) {
    if (hostname === "::1" || hostname === "::") return false;
    if (hostname.startsWith("fe8") || hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb")) return false; // fe80::/10 link-local
    if (hostname.startsWith("fc") || hostname.startsWith("fd")) return false; // fc00::/7 unique local

    // IPv4-mapped IPv6. Node's URL parser normalizes the dotted-decimal form
    // (::ffff:127.0.0.1) to pure hex (::ffff:7f00:1) - only the hex form
    // ever actually reaches this point, but both are matched defensively in
    // case a differently-normalized string arrives some other way.
    const mappedDotted = hostname.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mappedDotted?.[1] && isPrivateIPv4(mappedDotted[1])) return false;

    const mappedHex = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex?.[1] && mappedHex[2]) {
      const high = mappedHex[1].padStart(4, "0");
      const low = mappedHex[2].padStart(4, "0");
      const ipv4 = [parseInt(high.slice(0, 2), 16), parseInt(high.slice(2, 4), 16), parseInt(low.slice(0, 2), 16), parseInt(low.slice(2, 4), 16)].join(".");
      if (isPrivateIPv4(ipv4)) return false;
    }
  }

  return true;
}
