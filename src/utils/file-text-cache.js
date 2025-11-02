// javascript
const fs = require("node:fs");

class FileTextCache {
  #cache;
  constructor() { this.#cache = new Map(); }

  readText(file, fallback = "") {
    if (this.#cache.has(file)) return this.#cache.get(file);
    let data = fallback;
    try {
      if (fs.existsSync(file)) data = fs.readFileSync(file, "utf8");
    } catch {
      // keep fallback
    }
    this.#cache.set(file, data);
    return data;
  }

  clear() { this.#cache.clear(); }
}

module.exports = { FileTextCache };