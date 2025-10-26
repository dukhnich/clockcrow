class BaseLocationStore {
  #baseDir;
  #fileCache;
  #byLocation;
  constructor(baseDir = require("node:path").join("scenario", "locations"), fileCache) {
    this.#baseDir = baseDir;
    this.#fileCache = fileCache; // shared pool (FileJsonCache)
    this.#byLocation = new Map(); // locationId -> Map<id, obj>
  }
  get baseDir() { return this.#baseDir; }
  get fileCache() { return this.#fileCache; }

  // Subclasses must implement this, returning Map<id, obj>
  loadLocationMap(/* locationId */) { throw new Error("Not implemented"); }

  #ensureLoaded(locationId) {
    if (!this.#byLocation.has(locationId)) {
      const map = this.loadLocationMap(locationId);
      this.#byLocation.set(locationId, map instanceof Map ? map : new Map());
    }
  }

  get(locationId, id) {
    this.#ensureLoaded(locationId);
    const obj = this.#byLocation.get(locationId)?.get(id) || null;
    return obj ? { ...obj } : null; // shallow clone
  }

  getMany(locationId, ids = []) {
    this.#ensureLoaded(locationId);
    const map = this.#byLocation.get(locationId);
    return ids.map(i => map.get(i)).filter(Boolean).map(o => ({ ...o }));
  }

  list(locationId) {
    this.#ensureLoaded(locationId);
    return Array.from(this.#byLocation.get(locationId).values()).map(o => ({ ...o }));
  }

  listIds(locationId) {
    this.#ensureLoaded(locationId);
    return Array.from(this.#byLocation.get(locationId).keys());
  }

  clear(locationId) {
    if (locationId) this.#byLocation.delete(locationId);
    else this.#byLocation.clear();
  }
}
module.exports = { BaseLocationStore };