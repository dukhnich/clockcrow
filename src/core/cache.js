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
  #history;

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

  #ensureLocation(locationId) {
    const infoPath = path.join(this.#baseDir, locationId, "info.json");
    const info = this.#jsonPool.readJson(infoPath, {});
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

    // register current location and preload its path destinations
    this.#ensureLocation(locationId);
    this.#ensurePathsForLocation(locationId, sceneId);

    const prev = this.#ptr;
    this.#ptr = { locationId: String(locationId), sceneId: sceneId ? String(sceneId) : undefined };
    if (!prev || prev.locationId !== this.#ptr.locationId || prev.sceneId !== this.#ptr.sceneId) {
      this.#history.push({ locationId: this.#ptr.locationId, sceneId: this.#ptr.sceneId });
    }
    return this.#ptr;
  }

  get pointer() { return this.#ptr; }
  get history() { return this.#history.slice(); }

  currentScene() {
    if (!this.#ptr) return null;
    const { locationId } = this.#ptr;
    const infoPath = path.join(this.#baseDir, locationId, "info.json");
    const info = this.#jsonPool.readJson(infoPath, {});

    // Pick scene by explicit id or by current time window.
    const sceneId = this.#ptr.sceneId;
    const sceneObj = (Array.isArray(info.scenes)
      ? (sceneId
        ? info.scenes.find(s => s && s.id === sceneId)
        : info.scenes.find(s => this.#isSceneAllowedNow(s)))
      : null) || null;

    // Preload path destinations for the resolved scene
    if (sceneObj) this.#ensurePathsForLocation(locationId, sceneObj.id);

    const resolvedSceneId = (sceneObj && sceneObj.id)
      || info.startSceneId
      || (Array.isArray(info.scenes) && info.scenes[0] && info.scenes[0].id)
      || "start";

    return new Scene(resolvedSceneId, locationId, {
      description: (sceneObj && sceneObj.description) || info.description || "",
      options: (sceneObj && sceneObj.options) || [],
      optionIds: (sceneObj && sceneObj.optionIds) || [],
      npc: (sceneObj && sceneObj.npc) || [],
      path: (sceneObj && sceneObj.path) || [],
      currentNpc: (sceneObj && sceneObj.currentNpc) || null
    });
  }

  applyResult(result) {
    if (!this.#ptr) return this.#ptr;
    if (result == null) return this.#ptr;

    if (typeof result === "string") {
      if (result.startsWith("go:")) {
        const nextLocationId = result.slice(3);
        if (nextLocationId) this.setCurrent(nextLocationId, undefined);
      }
      return this.#ptr;
    }

    if (typeof result === "object") {
      const go = result.go && typeof result.go === "object" ? result.go : null;
      const loc = String(result.locationId || result.location || (go && (go.locationId || go.location)) || "");
      const scn = result.sceneId || (go && go.sceneId) || undefined;
      if (loc) this.setCurrent(loc, scn ? String(scn) : undefined);
      return this.#ptr;
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
