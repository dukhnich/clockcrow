class MovementManager {
  #cache;
  #inventory;
  #unsubscribe;
  #speed;
  constructor({ cache, inventory } = {}) {
    if (!cache) throw new Error("MovementManager requires a SceneCache");
    this.#cache = cache;
    this.#speed = 1;
    this.attachInventory(inventory);
  }

  attachInventory(inventory) {
    if (this.#unsubscribe && this.#inventory) {
      this.#inventory.unsubscribe(this.#unsubscribe);
    }
    this.#inventory = inventory || null;

    if (this.#inventory && typeof this.#inventory.subscribe === 'function') {
      const handler = (e) => {
        // Recompute on any add/remove; dedicated speed events are emitted too
        const t = e?.type;
        if (t === 'speedItemAdded' || t === 'speedItemRemoved') {
          this.#recomputeSpeed();
        }
      };
      this.#inventory.subscribe(handler);
      this.#unsubscribe = handler;
    }
    this.#recomputeSpeed();
  }
  #recomputeSpeed() {
    let s = 1;
    const items = this.#inventory?.getAll?.() || [];
    for (const it of items) {
      console.log(it, it.speed);
      const v = Number(it?.speed);
      if (Number.isFinite(v) && v > s) s = v;
    }
    this.#speed = s;
  }
  getSpeed() {
    return this.#speed;
  }
  computeTime(normalTime, ctx = {}) {
    console.log(this.#speed, this.#inventory?.getAll(), normalTime, ctx)
    const t = Number(normalTime);
    if (!Number.isFinite(t) || t <= 0) return 0;
    if (ctx?.kind === 'travel') return t / (this.#speed || 1);
    return t;
  }


  get pointer() { return this.#cache.pointer; }
  get history() { return this.#cache.history; }
  get currentScene() { return this.#cache.currentScene(); }
  get currentLocationId() { return (this.#cache.pointer || {}).locationId; }

  go(cmdOrObj) {
    this.#cache.applyResult(cmdOrObj);
  }

  setCurrent(locationId, sceneId) {
    this.#cache.setCurrent(locationId, sceneId);
  }
}

module.exports = { MovementManager };