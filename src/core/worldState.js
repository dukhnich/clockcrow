class WorldState {
  #added;    // Map<locationId, Map<itemId, count>>
  #removed;  // Map<locationId, Map<itemId, count>>
  #defaults; // Map<locationId, Map<itemId, count>>

  constructor() {
    this.#added = new Map();
    this.#removed = new Map();
    this.#defaults = new Map();
  }

  reset() {
    this.#added.clear();
    this.#removed.clear();
    this.#defaults.clear();
  }

  // Internal helpers
  #ensureLoc(map, loc) {
    const id = String(loc);
    if (!map.has(id)) map.set(id, new Map());
    return map.get(id);
  }
  #getCount(map, loc, id) {
    const m = map.get(String(loc));
    if (!m) return 0;
    return m.get(String(id)) || 0;
  }
  #setCount(map, loc, id, val) {
    const m = this.#ensureLoc(map, loc);
    m.set(String(id), Math.max(0, Number(val) || 0));
  }
  #inc(map, loc, id, delta) {
    const cur = this.#getCount(map, loc, id);
    this.#setCount(map, loc, id, cur + Number(delta));
  }

  // Seed defaults from scene inventory; does not overwrite removals.
  // items: [{ id, quantity|qty|count }]
  applySceneInventory(locationId, items) {
    if (!locationId) return;
    const list = Array.isArray(items) ? items : [];
    for (const it of list) {
      if (!it || !it.id) continue;
      const id = String(it.id);
      const qtyRaw = it.quantity ?? it.qty ?? it.count ?? 1;
      const qty = Number.isFinite(Number(qtyRaw)) ? Math.max(0, Number(qtyRaw)) : 1;

      const cur = this.#getCount(this.#defaults, locationId, id);
      if (qty > cur) this.#setCount(this.#defaults, locationId, id, qty);
      // Do not touch #removed here; removal is explicit via events.
    }
  }

  addLocationItem(locationId, itemId, qty = 1) {
    if (!locationId || !itemId) return;
    const n = Number.isFinite(Number(qty)) ? Number(qty) : 1;
    if (n === 0) return;
    this.#inc(this.#added, locationId, itemId, n);
  }

  removeLocationItem(locationId, itemId, qty = 1) {
    if (!locationId || !itemId) return;
    const n = Number.isFinite(Number(qty)) ? Number(qty) : 1;
    if (n === 0) return;

    // Cap removals to available net amount
    const available = this.#getCount(this.#defaults, locationId, itemId)
      + this.#getCount(this.#added, locationId, itemId)
      - this.#getCount(this.#removed, locationId, itemId);
    const take = Math.max(0, Math.min(available, n));
    if (take > 0) this.#inc(this.#removed, locationId, itemId, take);
  }

  hasLocationItem(locationId, itemId, qty = 1) {
    console.log(this.#getCount(this.#added, locationId, itemId))
    if (!locationId || !itemId) return false;
    const need = Number.isFinite(Number(qty)) ? Number(qty) : 1;
    const total =
      this.#getCount(this.#defaults, locationId, itemId) +
      this.#getCount(this.#added, locationId, itemId) -
      this.#getCount(this.#removed, locationId, itemId);
    return total >= need;
  }

  // Optional debug snapshot
  getLocationItemsSnapshot(locationId) {
    const loc = String(locationId);
    const snap = {};
    const merge = (map, key) => {
      const m = map.get(loc);
      if (!m) return;
      for (const [id, v] of m.entries()) {
        if (!snap[id]) snap[id] = { defaults: 0, added: 0, removed: 0, net: 0 };
        snap[id][key] = v;
      }
    };
    merge(this.#defaults, "defaults");
    merge(this.#added, "added");
    merge(this.#removed, "removed");
    for (const [id, s] of Object.entries(snap)) {
      s.net = Math.max(0, s.defaults + s.added - s.removed);
    }
    return snap;
  }
}

module.exports = { WorldState };