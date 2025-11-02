const fs = require("node:fs");
const path = require("node:path");
const { FileJsonCache } = require("../utils/file-json-cache.js");

class ItemStore {
  #baseDir;
  #json;

  constructor(baseDir = path.join(process.cwd(), "scenario", "items"), jsonPool = new FileJsonCache()) {
    this.#baseDir = baseDir;
    this.#json = jsonPool;
  }

  #fileFor(id) {
    const safe = String(id).trim();
    if (!safe) return null;
    return path.join(this.#baseDir, `${safe}.json`);
  }

  #normalize(id, raw) {
    const obj = (raw && typeof raw === "object") ? raw : {};
    const name = obj.name || obj.title || id;
    return { ...raw, id, name };
  }

  has(id) {
    const file = this.#fileFor(id);
    if (!file) return false;
    try { return fs.existsSync(file); } catch { return false; }
  }

  get(id) {
    const file = this.#fileFor(id);
    if (!file) return null;
    try {
      const raw = this.#json.readJson(file);
      return this.#normalize(String(id), raw);
    } catch {
      return { id: String(id), name: String(id), description: "" };
    }
  }

  getDTO(id) {
    return this.get(id);
  }

  getMany(ids) {
    const arr = Array.isArray(ids) ? ids : [];
    return arr.map(i => this.get(i)).filter(Boolean);
  }

  listIds() {
    try {
      return fs.readdirSync(this.#baseDir)
        .filter(f => f.toLowerCase().endsWith(".json"))
        .map(f => f.replace(/\.json$/i, ""));
    } catch {
      return [];
    }
  }

  toPlain() {
    const out = {};
    for (const id of this.listIds()) {
      const dto = this.get(id);
      out[id] = { name: dto.name, description: dto.description };
    }
    return out;
  }
}

module.exports = { ItemStore };