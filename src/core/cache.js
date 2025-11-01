const { Hint } = require("./hint.js");

const path = require("node:path");
const { Scene, SceneAssembler } = require("../scene/scene.js");
const { FileJsonCache } = require("../utils/file-json-cache.js");
const { OptionStore } = require("../scene/option-store.js");
const { NpcStore } = require("../scene/npc-store.js");
const { LocationFlyweightStore } = require("../scene/location.js");

class SceneCache {
  #jsonPool;
  #optionStore;
  #npcStore;
  #locationStore;
  #assembler;
  #timeManager;

  #baseDir;
  #ptr;        // { locationId, sceneId }
  #history;    // [{ locationId, sceneId }]

  constructor(opts = {}) {
    this.#baseDir = opts.baseDir || path.join(process.cwd(), "scenario", "locations");
    this.#jsonPool = opts.jsonPool || new FileJsonCache();
    this.#optionStore = opts.optionStore || new OptionStore(this.#baseDir, this.#jsonPool);
    this.#npcStore = opts.npcStore || new NpcStore(this.#baseDir, this.#jsonPool);
    this.#locationStore = opts.locationStore || new LocationFlyweightStore();
    this.#timeManager = opts.timeManager || null;
    this.#assembler = new SceneAssembler({
      optionStore: this.#optionStore,
      npcStore: this.#npcStore,
      locationStore: this.#locationStore
    });

    this.#history = [];
    if (opts.start?.locationId) {
      this.setCurrent(opts.start.locationId, opts.start.sceneId);
    }
  }

  // Ensure location is registered and return its info.json content
  #ensureLocation(locationId) {
    const infoPath = path.join(this.#baseDir, locationId, "info.json");
    const info = this.#jsonPool.readJson(infoPath);
    if (!info || typeof info !== "object") {
      return {}
    }
    this.#locationStore.ensure(locationId, {
      title: info.name || info.title || locationId,
      background: info.background
    });
    return info;
  }

  #ensurePathsForLocation(locationId, sceneId) {
    const info = this.#ensureLocation(locationId);
    const scenes = Array.isArray(info.scenes) ? info.scenes : [];
    if (!scenes.length) return;
    let targets = [];
    if (sceneId) {
      const s = scenes.find(sc => sc && sc.id === sceneId);
      if (s) targets = [s];
    } else {
      targets = scenes;
    }
    for (const s of targets) {
      const pathIds = Array.isArray(s.path) ? s.path : [];
      for (const locId of pathIds) {
        this.#ensureLocation(locId);
      }
    }
  }

  #isSceneAllowedNow(sceneObj) {
    // 1) Explicit window support
    const win = String(sceneObj.window || "").toLowerCase();
    if (win === "any") return true;
    if (win === "day" || win === "night") {
      return this.#timeManager.getTimeWindow() === win;
    }

    // 2) Numeric time window: from/to in hours (can wrap midnight)
    const from = Number(sceneObj.from);
    const to = Number(sceneObj.to);
    // If no valid time constraints provided, allow by default
    if (!Number.isFinite(from) && !Number.isFinite(to)) return true;

    const end = 24;
    const norm = (v) => {
      let x = Number(v);
      if (!Number.isFinite(x)) return NaN;
      x = ((x % end) + end) % end;
      return x;
    };

    const f = norm(from);
    const t = norm(to);
    const now = norm(this.#timeManager.currentTime);

    if (Number.isNaN(f) || Number.isNaN(t) || Number.isNaN(now)) return true;

    // Exact hour case (e.g., from=9, to=9 → only at 9:00)
    if (f === t) return Math.abs(now - f) < 1e-9;

    // Normal range [from, to)
    if (f < t) return now >= f && now < t;

    // Wrapped range (e.g., 21→9): now in [from, 24) or [0, to)
    return now >= f || now < t;
  }

  setCurrent(locationId, sceneId) {
    if (!locationId) return;
    const info = this.#ensureLocation(locationId);
    this.#ensurePathsForLocation(locationId, sceneId);
    const exists = Array.isArray(info.scenes) && info.scenes.some(s => s && s.id === sceneId);
    let resolvedSceneId = exists
      ? sceneId
      : (info.startSceneId
        || (Array.isArray(info.scenes) && info.scenes[0] && info.scenes[0].id)
        || sceneId);

    if (Array.isArray(info.scenes) && this.#timeManager) {
      const picked = info.scenes.find(s => s && s.id === resolvedSceneId) || null;
      if (!this.#isSceneAllowedNow(picked)) {
        const alt = info.scenes.find(s => this.#isSceneAllowedNow(s));
        if (alt && alt.id) {
          resolvedSceneId = alt.id;
        }
      }
    }

    this.#ptr = { locationId, sceneId: resolvedSceneId };
    this.#history.push({ ...this.#ptr });
    return this.#ptr;
  }

  get pointer() { return this.#ptr; }
  get history() { return this.#history.slice(); }

  currentScene() {
    if (!this.#ptr) return null;
    const { locationId } = this.#ptr;
    let { sceneId } = this.#ptr;
    const info = this.#ensureLocation(locationId);
    if (Array.isArray(info.scenes) && this.#timeManager) {
      const picked = info.scenes.find(s => s && s.id === sceneId) || null;
      if (!this.#isSceneAllowedNow(picked)) {
        const alt = info.scenes.find(s => this.#isSceneAllowedNow(s));
        if (alt && alt.id) {
          // Update pointer silently (no history push)
          this.#ptr = { locationId, sceneId: alt.id };
          sceneId = alt.id;
        }
      }
    }
    const sceneObj = (Array.isArray(info.scenes)
      ? info.scenes.find(s => s && s.id === sceneId)
      : null) || {};

    return new Scene(sceneId, locationId, {
      description: Array.isArray(sceneObj.description) ? sceneObj.description : (sceneObj.description || ""),
      optionIds: Array.isArray(sceneObj.optionIds) ? sceneObj.optionIds : [],
      path: Array.isArray(sceneObj.path) ? sceneObj.path : (Array.isArray(info.path) ? info.path : []),
      npcIds: Array.isArray(sceneObj.npcIds) ? sceneObj.npcIds : []
    });
  }

  applyResult(result) {
    if (!this.#ptr) return this.#ptr;
    if (result == null) return this.#ptr;

    if (typeof result === "object") {
      const nextSceneId = result.go || result.nextSceneId || result.sceneId || null;
      const nextLocationId = result.locationId || this.#ptr.locationId;

      if (nextSceneId) {
        this.setCurrent(nextLocationId, nextSceneId);
      } else if (result.locationId && result.locationId !== this.#ptr.locationId) {
        // Jump to location's default start scene
        this.setCurrent(result.locationId, undefined);
      }
    }
    return this.#ptr;
  }

  // Expose assembler for consumers that need to resolve options/NPCs
  get assembler() { return this.#assembler; }
  get stores() {
    return {
      optionStore: this.#optionStore,
      npcStore: this.#npcStore,
      locationStore: this.#locationStore
    };
  }
}

module.exports = { SceneCache };
