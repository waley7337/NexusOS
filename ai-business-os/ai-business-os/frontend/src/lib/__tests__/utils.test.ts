import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../utils";

describe("formatRelativeTime", () => {
  const now = 1_700_000_000_000;

  it("returns 'just now' under 45 seconds", () => {
    expect(formatRelativeTime(now - 10_000, now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe("2 min ago");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3 h ago");
  });

  it("formats days", () => {
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2 d ago");
  });

  it("never goes negative for a future timestamp", () => {
    expect(formatRelativeTime(now + 5000, now)).toBe("just now");
  });
});
