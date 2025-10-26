// NPCs: `npc.json` is an array [{ id|name, ... }]
const path = require("node:path");
const { BaseLocationStore } = require("./base-location-store.js");

class NpcStore extends BaseLocationStore {
  loadLocationMap(locationId) {
    const file = path.join(this.baseDir, locationId, "npc.json");
    const arr = this.fileCache?.readJson(file, []) || [];
    const map = new Map();
    for (const npc of Array.isArray(arr) ? arr : []) {
      const id = npc && (npc.id || npc.name);
      if (!id) continue;
      map.set(String(id), { id: String(id), ...npc });
    }
    return map;
  }

  getOptionsForNpc(locationId, npcId) {
    const npc = this.get(locationId, npcId);
    if (!npc) return [];
    return Array.isArray(npc.options) ? npc.options.slice() : [];
  }

  list(locationId) {
    return super.list(locationId).map(n => ({ id: n.id, name: n.name || n.id }));
  }
}
module.exports = { NpcStore };