const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { FileJsonCache } = require("../../src/scene/file-json-cache.js");

describe("FileJsonCache", () => {
  let tmpDir;
  let cache;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scene-json-"));
    cache = new FileJsonCache();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test("returns default for missing file", () => {
    const missing = path.join(tmpDir, "missing.json");
    const def = { foo: 1 };
    const data = cache.readJson(missing, def);
    expect(data).toEqual(def);
  });

  test("reads and parses json", () => {
    const file = path.join(tmpDir, "data.json");
    fs.writeFileSync(file, JSON.stringify({ a: 1 }), "utf8");
    const data = cache.readJson(file, {});
    expect(data).toEqual({ a: 1 });
  });

  test("caches content across reads", () => {
    const file = path.join(tmpDir, "data.json");
    fs.writeFileSync(file, JSON.stringify({ a: 1 }), "utf8");

    const first = cache.readJson(file, {});
    expect(first).toEqual({ a: 1 });

    // Mutate file after first read
    fs.writeFileSync(file, JSON.stringify({ a: 2 }), "utf8");

    // Should still return cached value
    const second = cache.readJson(file, {});
    expect(second).toEqual({ a: 1 });
  });
});