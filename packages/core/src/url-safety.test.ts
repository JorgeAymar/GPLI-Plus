import { describe, expect, it } from "vitest";
import { isSafeExternalUrl } from "./url-safety";

describe("isSafeExternalUrl (pure function, anti-SSRF guard)", () => {
  it("accepts a normal public https URL", () => {
    expect(isSafeExternalUrl("https://example.com/feed.xml")).toBe(true);
  });

  it("accepts a normal public http URL", () => {
    expect(isSafeExternalUrl("http://example.com/feed.xml")).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeExternalUrl("ftp://example.com/feed.xml")).toBe(false);
  });

  it("rejects an unparsable URL", () => {
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });

  it("rejects localhost and IPv4/IPv6 loopback", () => {
    expect(isSafeExternalUrl("http://localhost/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://127.0.0.1/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://[::1]/feed.xml")).toBe(false);
  });

  it("rejects private IPv4 ranges (0/8, 10/8, 172.16/12, 192.168/16, 169.254/16)", () => {
    expect(isSafeExternalUrl("http://0.0.0.1/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://10.0.0.5/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://172.16.0.5/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://172.31.255.255/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://192.168.1.1/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://169.254.169.254/feed.xml")).toBe(false); // cloud metadata endpoint
  });

  it("does not false-positive on a public IP that merely starts with a private-looking octet (e.g. 172.32.x.x is outside 172.16/12)", () => {
    expect(isSafeExternalUrl("http://172.32.0.1/feed.xml")).toBe(true);
  });

  it("rejects IPv6 link-local (fe80::/10)", () => {
    expect(isSafeExternalUrl("http://[fe80::1]/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://[febf::1]/feed.xml")).toBe(false);
  });

  it("rejects IPv6 unique-local (fc00::/7)", () => {
    expect(isSafeExternalUrl("http://[fc00::1]/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://[fd12:3456:789a::1]/feed.xml")).toBe(false);
  });

  it("rejects the IPv6 unspecified address", () => {
    expect(isSafeExternalUrl("http://[::]/feed.xml")).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 addresses pointing at a private IPv4 (e.g. ::ffff:127.0.0.1)", () => {
    expect(isSafeExternalUrl("http://[::ffff:127.0.0.1]/feed.xml")).toBe(false);
    expect(isSafeExternalUrl("http://[::ffff:169.254.169.254]/feed.xml")).toBe(false);
  });

  it("does not false-positive on a public IPv6 address", () => {
    expect(isSafeExternalUrl("http://[2001:4860:4860::8888]/feed.xml")).toBe(true);
  });
});
