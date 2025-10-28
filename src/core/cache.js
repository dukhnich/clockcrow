const { Hint } = require("./hint.js");

const path = require("node:path");
const { Scene, SceneAssembler } = require("../scene/scene.js");
const { FileJsonCache } = require("../scene/file-json-cache.js");
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
    const info = this.#jsonPool.readJson(infoPath, {});
    this.#locationStore.ensure(locationId, {
      title: info.name || info.title || locationId,
      background: info.background
    });
    return info;
  }

  #isSceneAllowedNow(sceneObj) {
    if (!sceneObj || !this.#timeManager) return true;
    const w = (sceneObj.window || "any").toLowerCase();
    if (w === "any") return true;
    const now = this.#timeManager.getTimeWindow();
    return w === now;
  }

  setCurrent(locationId, sceneId) {
    const info = this.#ensureLocation(locationId);
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
    const { locationId, sceneId } = this.#ptr;
    const info = this.#ensureLocation(locationId);
    const sceneObj = (Array.isArray(info.scenes)
      ? info.scenes.find(s => s && s.id === sceneId)
      : null) || {};

    return new Scene(sceneId, locationId, {
      description: Array.isArray(sceneObj.description) ? sceneObj.description : (sceneObj.description || ""),
      optionIds: Array.isArray(sceneObj.optionIds) ? sceneObj.optionIds : [],
      path: Array.isArray(sceneObj.path) ? sceneObj.path : (Array.isArray(info.path) ? info.path : [])
    });
  }

  // Advance pointer based on controller result
  applyResult(result) {
    if (!this.#ptr) return this.#ptr;

    let nextSceneId = null;
    let nextLocationId = this.#ptr.locationId;

    if (typeof result === "string") {
      if (result.startsWith("go:")) {
        const payload = result.slice(3);
        const parts = payload.split(":").filter(Boolean);

        if (parts.length >= 2) {
          // go:locationId:sceneId
          nextLocationId = parts[0];
          nextSceneId = parts[1];
        } else if (parts.length === 1) {
          const token = parts[0];

          // Try as scene in current location first
          const currInfo = this.#ensureLocation(this.#ptr.locationId);
          const isSceneHere = Array.isArray(currInfo.scenes)
            && currInfo.scenes.some(s => s && s.id === token);

          if (isSceneHere) {
            // go:sceneId (same location)
            nextLocationId = this.#ptr.locationId;
            nextSceneId = token;
          } else {
            // go:locationId → jump to that location's startSceneId
            nextLocationId = token;
            nextSceneId = null; // will resolve to startSceneId below
          }
        }
      }
    } else if (result && typeof result === "object") {
      nextSceneId = result.go || result.nextSceneId || result.sceneId || null;
      if (result.locationId) {
        nextLocationId = result.locationId;
      }
    }

    if (nextSceneId) {
      this.setCurrent(nextLocationId, nextSceneId);
    } else if (nextLocationId !== this.#ptr.locationId) {
      // Move to the location's default start scene
      this.setCurrent(nextLocationId, undefined);
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

class Cache {
    #key;
    #tasks;
    #hints;
    constructor(key) {
        this.#key = key;
        this.#tasks = new Map();
        this.#hints = new Map();
    }
    get key() { return this.#key; }
    get currentTask() { return this.task(this.#key); }
    get currentHint() { return this.hint(this.#key); }
    task(key) { let t = this.#tasks.get(key); return t != null? t : Task.none; }
    hint(key) { let h = this.#hints.get(key); return h != null? h : Hint.none; }
    update(key) {
        if (this.#key === key) {
            return false;
        }
        this.#key = key;

        let switchCache = (cache, key) => {
            let value = cache.get(key);
            if (value == null) {
                cache.clear();
                return false;
            }
            cache = new Map([[key, value]]);
            return true;
        };
        if (!switchCache(this.#tasks, this.#key)) {
            this.loadTask(this.#key);
        }
        if (!switchCache(this.#hints, this.#key)) {
            this.loadHint(this.#key);
        }
        for (let i = 1; i <= this.currentTask.options.length; ++i) {
            let key = this.#key + i;
            this.loadTask(key);
            this.loadHint(key);
        }
        return true;
    }

    loadTask(key) { return null; }
    loadHint(key) { return null; }
    addTask(key, task) { this.#tasks.set(key, task); }
    addHint(key, hint) { this.#hints.set(key, hint); }
};

class FileCache extends Cache {
    static #TASK = "task";
    static #HINT = "hint";
    static #EXT = ".txt";
    #dir;
    constructor(dir, key) {
        super("");
        this.#dir = dir;
        this.update(key);
    }

    loadTask(key) {
        let task = Task.load(this.#dir + "/" + FileCache.#TASK + key + FileCache.#EXT);
        this.addTask(key, task);
        return task;
    }
    loadHint(key) {
        let hint = Hint.load(this.#dir + "/" + FileCache.#HINT + key + FileCache.#EXT);
        this.addHint(key, hint);
        return hint;
    }
};

module.exports = { Cache, FileCache, SceneCache };
