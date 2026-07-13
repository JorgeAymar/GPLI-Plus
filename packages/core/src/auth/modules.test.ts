import { describe, expect, it } from "vitest";
import { MODULE, moduleKeyForItilType } from "./modules";

describe("MODULE constants", () => {
  it("has no duplicate values (each moduleKey string is unique)", () => {
    const values = Object.values(MODULE);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("has no duplicate keys (object literal integrity)", () => {
    const keys = Object.keys(MODULE);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("every value follows the dotted lowercase 'domain.key' shape", () => {
    for (const value of Object.values(MODULE)) {
      expect(value).toMatch(/^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/);
    }
  });

  it("is a non-empty object", () => {
    expect(Object.keys(MODULE).length).toBeGreaterThan(0);
  });
});

describe("moduleKeyForItilType", () => {
  it("maps 'ticket' to MODULE.ASSISTANCE_TICKET", () => {
    expect(moduleKeyForItilType("ticket")).toBe(MODULE.ASSISTANCE_TICKET);
  });

  it("maps 'problem' to MODULE.ASSISTANCE_PROBLEM", () => {
    expect(moduleKeyForItilType("problem")).toBe(MODULE.ASSISTANCE_PROBLEM);
  });

  it("maps 'change' to MODULE.ASSISTANCE_CHANGE", () => {
    expect(moduleKeyForItilType("change")).toBe(MODULE.ASSISTANCE_CHANGE);
  });
});
