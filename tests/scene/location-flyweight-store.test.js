const { LocationFlyweightStore } = require("../../src/scene/location.js");

describe("LocationFlyweightStore", () => {
  test("ensure returns same instance for same id", () => {
    const store = new LocationFlyweightStore();
    const a1 = store.ensure("start", { title: "Start", background: "bg.png" });
    const a2 = store.ensure("start", { title: "Changed" });
    expect(a1).toBe(a2);
  });

  test("ensure returns different instances for different ids", () => {
    const store = new LocationFlyweightStore();
    const a = store.ensure("start", { title: "Start" });
    const b = store.ensure("market", { title: "Market" });
    expect(a).not.toBe(b);
  });
});