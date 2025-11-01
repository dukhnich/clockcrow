class Location {
  #info
  #id
  #baseDir
  #scenes
  constructor(id, info = {}, baseDir = process.cwd(), scenes = []) {
    this.#id = id;
    this.#info = info || {};
    this.#baseDir = baseDir;
    this.#scenes = new Map();
    scenes.forEach(s => this.scenes.set(s.id, s));
  }
  get name() {
    return this.info.title || this.info.name || this.id;
  }

  get background() {
    // can be string path or array of lines; view handles both
    return this.info.background;
  }
  get info() { return { ...this.#info }; }

  get scenes() { return this.#scenes; }

  getScene(id) {
    return this.scenes.get(id) || null;
  }

  get startSceneId() {
    if (this.info.startSceneId && this.scenes.has(this.info.startSceneId)) {
      return this.info.startSceneId;
    }
    const first = [...this.scenes.keys()][0];
    return first || null;
  }
}

class LocationFlyweight {
  #id;
  #name;
  #background;

  constructor(id, name, background) {
    this.#id = id;
    this.#name = name || id;
    // keep raw descriptor: string path | string[] | object
    this.#background = background;
  }

  toDTO() {
    return {
      id: this.#id,
      name: this.#name,
      background: this.#background
    };
  }
}

class LocationFlyweightStore {
  #map;
  constructor() {
    this.#map = new Map();
  }

  ensure(locationId, info = {}) {
    if (!locationId) throw new Error("locationId is required");
    if (this.#map.has(locationId)) return this.#map.get(locationId);
    const name = info.title || info.name || locationId;
    const background = info.background;
    const fw = new LocationFlyweight(locationId, name, background);
    this.#map.set(locationId, fw);
    return fw;
  }

  has(locationId) {
    return this.#map.has(String(locationId));
  }

  getDTO(locationId) {
    const fw = this.#map.get(locationId);
    if (!fw) throw new Error(`Location flyweight missing for ${locationId}`);
    return fw.toDTO();
  }
}

module.exports = { Location, LocationFlyweight, LocationFlyweightStore };