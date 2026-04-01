import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { progressiveDelayMs } from "./login-throttle.js";

describe("progressiveDelayMs", () => {
  it("returns 0 for first failures", () => {
    assert.equal(progressiveDelayMs(0), 0);
    assert.equal(progressiveDelayMs(1), 0);
  });

  it("increases with repeated failures", () => {
    const d2 = progressiveDelayMs(2);
    const d4 = progressiveDelayMs(4);
    assert.ok(d2 > 0);
    assert.ok(d4 >= d2);
  });

  it("caps delay", () => {
    assert.equal(progressiveDelayMs(99), 3200);
  });
});
