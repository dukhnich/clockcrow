class MovementManager {
  #cache;
  constructor({ cache }) {
    if (!cache) throw new Error("MovementManager requires a SceneCache");
    this.#cache = cache;
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