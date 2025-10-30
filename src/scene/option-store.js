// Options: `options.json` is an object { "<id>": { ... } }
const path = require("node:path");
const { BaseStore } = require("../utils/base-store.js");

class OptionStore extends BaseStore {
  loadLocationMap(locationId) {
    const file = path.join(this.baseDir, locationId, "options.json");
    const json = this.fileCache?.readJson(file, {}) || {};
    const map = new Map();
    for (const [id, obj] of Object.entries(json || {})) map.set(id, { id, ...obj });
    return map;
  }
}
module.exports = { OptionStore };