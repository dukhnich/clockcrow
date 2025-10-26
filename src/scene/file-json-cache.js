const fs = require("node:fs");

class FileJsonCache {
  #cache;
  constructor() { this.#cache = new Map(); }

  readJson(file, fallback = null) {
    if (this.#cache.has(file)) return this.#cache.get(file);
    let data = fallback;
    try {
      if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch { /* keep fallback */ }
    this.#cache.set(file, data);
    return data;
  }

  clear() { this.#cache.clear(); }
}
module.exports = { FileJsonCache };