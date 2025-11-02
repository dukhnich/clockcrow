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
    if (!locationId || !itemId) return false;
    const need = Number(qty);
    const base = this.#getCount(this.#defaults, locationId, itemId);
    const add = this.#getCount(this.#added, locationId, itemId);
    const rem = this.#getCount(this.#removed, locationId, itemId);
    const net = Math.max(0, base + add - rem);
    return net >= (Number.isFinite(need) ? need : 1);
  }

  // Optional debug snapshot
  getLocationItemsSnapshot(locationId) {
    const out = {};
    const loc = String(locationId);

    const allIds = new Set([
      ...Object.keys(this.#toPlainLoc(this.#defaults, loc)),
      ...Object.keys(this.#toPlainLoc(this.#added, loc)),
      ...Object.keys(this.#toPlainLoc(this.#removed, loc))
    ]);
    for (const id of allIds) {
      const base = this.#getCount(this.#defaults, loc, id);
      const add = this.#getCount(this.#added, loc, id);
      const rem = this.#getCount(this.#removed, loc, id);
      const net = Math.max(0, base + add - rem);
      if (net > 0) out[id] = net;
    }
    return out;
  }
  getSnapshot() {
    return {
      version: 1,
      defaults: this.#toPlain(this.#defaults),
      added: this.#toPlain(this.#added),
      removed: this.#toPlain(this.#removed),
    };
  }

  loadSnapshot(snap) {
    if (!snap || typeof snap !== "object") return;
    this.reset();
    this.#defaults = this.#fromPlain(snap.defaults || {});
    this.#added = this.#fromPlain(snap.added || {});
    this.#removed = this.#fromPlain(snap.removed || {});
  }

  #toPlain(map) {
    const out = {};
    for (const [loc, m] of map.entries()) {
      const inner = {};
      for (const [id, cnt] of m.entries()) {
        if (cnt > 0) inner[id] = cnt;
      }
      if (Object.keys(inner).length) out[loc] = inner;
    }
    return out;
  }
  #toPlainLoc(map, loc) {
    const m = map.get(String(loc));
    if (!m) return {};
    const out = {};
    for (const [id, cnt] of m.entries()) if (cnt > 0) out[id] = cnt;
    return out;
  }
  #fromPlain(obj) {
    const outer = new Map();
    for (const [loc, inner] of Object.entries(obj || {})) {
      const m = new Map();
      for (const [id, cnt] of Object.entries(inner || {})) {
        const n = Number(cnt);
        if (Number.isFinite(n) && n > 0) m.set(String(id), n);
      }
      if (m.size) outer.set(String(loc), m);
    }
    return outer;
  }
}

module.exports = { WorldState };