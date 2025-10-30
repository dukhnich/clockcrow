const path = require("node:path");
const { FileJsonCache } = require("../utils/file-json-cache.js");
const { Trait } = require("./traitsManager.js");

class TraitsStore {
  #file;
  #cache;
  constructor(file = path.join(process.cwd(), "scenario", "traits.json"), fileCache = new FileJsonCache()) {
    this.#file = file;
    this.#cache = fileCache;
  }

  getAll() {
    const data = this.#cache.readJson(this.#file, { traits: [] }) || { traits: [] };
    const list = Array.isArray(data.traits) ? data.traits : [];
    return list.map(t => {
      const id = t.id || t.name || "trait";
      const desc = t.description || t.name || id;
      const side = t.side || undefined;
      return new Trait(id, desc, side, 0);
    });
  }
}

module.exports = { TraitsStore };