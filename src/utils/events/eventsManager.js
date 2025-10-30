class EventsManager {
  #map = new Map(); // type -> Set<fn>

  on(type, handler) {
    if (!type || typeof handler !== "function") return;
    if (!this.#map.has(type)) this.#map.set(type, new Set());
    this.#map.get(type).add(handler);
  }

  off(type, handler) {
    const set = this.#map.get(type);
    if (set) set.delete(handler);
  }

  emit(type, payload) {
    const set = this.#map.get(type);
    if (!set) return;
    // Synchronous emit to keep navigation deterministic
    for (const fn of set) {
      try { fn(payload); } catch { /* no-op */ }
    }
  }

  clear() {
    this.#map.clear();
  }
}

module.exports = { EventsManager };