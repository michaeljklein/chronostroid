import { describe, it, expect } from "vitest";
import { clockLabel, hpSegments } from "./hud";

describe("clockLabel", () => {
  it("returns '−5.3s' for presentTick=1000, zoneTick=680", () => {
    expect(clockLabel(1000, 680)).toBe("−5.3s");
  });

  it("returns null for presentTick=1000, zoneTick=1000", () => {
    expect(clockLabel(1000, 1000)).toBeNull();
  });

  it("returns '−1.0s' for presentTick=1000, zoneTick=940", () => {
    expect(clockLabel(1000, 940)).toBe("−1.0s");
  });
});

describe("hpSegments", () => {
  it("hp=7 → filled=7, depleted=3", () => {
    expect(hpSegments(7)).toEqual({ filled: 7, depleted: 3 });
  });

  it("hp=0 → filled=0, depleted=10", () => {
    expect(hpSegments(0)).toEqual({ filled: 0, depleted: 10 });
  });

  it("hp=10 → filled=10, depleted=0", () => {
    expect(hpSegments(10)).toEqual({ filled: 10, depleted: 0 });
  });
});
