// Options: `options.json` is an object { "<id>": { ... } }
const path = require("node:path");
const { BaseLocationStore } = require("./base-location-store.js");

class OptionStore extends BaseLocationStore {
  loadLocationMap(locationId) {
    const file = path.join(this.baseDir, locationId, "options.json");
    const json = this.fileCache
      ? this.fileCache.readJson(file, {})
      : (require("node:fs").existsSync(file) ? JSON.parse(require("node:fs").readFileSync(file, "utf8")) : {});
    const map = new Map();
    for (const [id, obj] of Object.entries(json || {})) map.set(id, { id, ...obj });
    return map;
  }
}
module.exports = { OptionStore };