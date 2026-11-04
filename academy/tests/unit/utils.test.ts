import { describe, expect, it } from "vitest";
import { formatDuration, formatPrice, formatTimestamp, percent } from "@/lib/utils";

describe("formattazione", () => {
  it("prezzi in euro all'italiana", () => {
    expect(formatPrice(19700)).toBe("197 €");
    expect(formatPrice(4990)).toBe("49,90 €");
  });
  it("durate", () => {
    expect(formatDuration(540)).toBe("9 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(11340)).toBe("3 h 9 min");
  });
  it("minutaggio", () => {
    expect(formatTimestamp(95)).toBe("01:35");
    expect(formatTimestamp(1170)).toBe("19:30");
    expect(formatTimestamp(3725)).toBe("1:02:05");
  });
  it("percentuali limitate tra 0 e 100", () => {
    expect(percent(3, 4)).toBe(75);
    expect(percent(5, 4)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });
});
