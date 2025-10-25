const fs = require("node:fs");
const path = require("node:path");

class Scene {
  #id
  #locationId
  #info

  constructor(id, locationId, info = {}) {
    this.#id = id;
    this.#locationId = locationId;
    this.#info = info || {};
  }

  get id() {
    return this.#id;
  }

  get locationId() {
    return this.#locationId;
  }
  get info() { return this.#info; }

  get description() {
    const d = this.info.description;
    if (Array.isArray(d)) return d;
    if (typeof d === "string" && d.length) return d;
    return "";
  }

  get options() {
    const arr = Array.isArray(this.info.options) ? this.info.options : [];
    return arr.map((o, idx) => {
      if (typeof o === "string") return { id: String(idx + 1), name: o };
      const id = o.id ?? String(idx + 1);
      const name = o.name ?? o.text ?? o.label ?? id;
      const next = o.next ?? null;
      return { id, name, next };
    });
  }

  get optionIds() {
    return Array.isArray(this.info.optionIds) ? this.info.optionIds.slice() : [];
  }

  get path() {
    return Array.isArray(this.info.path) ? this.info.path.slice() : [];
  }

  nextSceneId(optionValue) {
    const v = String(optionValue);
    const opt = this.options.find(o => o.id === v || o.name === v);
    return opt && opt.next ? opt.next : null;
  }

  // store: LocationFlyweightStore
  toViewDTO(store) {
    if (!this.locationId) throw new Error("Scene.locationId is required");
    const location = store.getDTO(this.locationId);
    const currentNpc = this.#pickCurrentNpc();
    return {
      location,                       // { id, name, background: any }
      description: this.description,  // string|string[]
      options: this.options.map(o => ({ id: o.id, name: o.name })),
      currentNpc                      // { id?, name?, text? } | null
    };
  }

  #pickCurrentNpc() {
    const npc = this.info.currentNpc
      ? this.info.currentNpc
      : (Array.isArray(this.info.npc) ? this.info.npc[0] : null);
    if (!npc) return null;
    const id = npc.id ?? undefined;
    const name = npc.name ?? undefined;
    const text = npc.text ?? npc.description ?? undefined;
    if (!name && !text) return null;
    return { id, name, text };
  }
}

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

  static loadFromDir(dir) {
    const infoPath = path.join(dir, "info.json");
    const raw = fs.readFileSync(infoPath, "utf8");
    const info = JSON.parse(raw);
    const id = info.id || path.basename(dir);

    const scenes = [];

    if (Array.isArray(info.scenes)) {
      for (const s of info.scenes) {
        if (s && (s.id || s.title || s.name)) {
          scenes.push(Scene.fromInfoObject(s, dir));
        }
      }
    }

    const scenesDir = path.join(dir, "scenes");
    if (fs.existsSync(scenesDir) && fs.statSync(scenesDir).isDirectory()) {
      for (const entry of fs.readdirSync(scenesDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const sceneDir = path.join(scenesDir, entry.name);
        const infoFile = path.join(sceneDir, "info.json");
        if (fs.existsSync(infoFile)) {
          scenes.push(Scene.loadFromDir(sceneDir));
        }
      }
    }

    return new Location(id, info, dir, scenes);
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

  getDTO(locationId) {
    const fw = this.#map.get(locationId);
    if (!fw) throw new Error(`Location flyweight missing for ${locationId}`);
    return fw.toDTO();
  }
}

class OptionStore {
  #baseDir;
  #cache = new Map(); // locationId -> Map<optionId, optionObj>

  constructor(baseDir = path.join("scenario", "locations")) {
    this.#baseDir = baseDir;
  }

  #ensureLoaded(locationId) {
    if (this.#cache.has(locationId)) return;
    const file = path.join(this.#baseDir, locationId, "options.json");
    const map = new Map();
    if (fs.existsSync(file)) {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const [id, obj] of Object.entries(json)) {
        map.set(id, { id, ...obj });
      }
    }
    this.#cache.set(locationId, map);
  }

  get(locationId, optionId) {
    this.#ensureLoaded(locationId);
    const map = this.#cache.get(locationId);
    return map.get(optionId) || null;
  }

  getMany(locationId, ids = []) {
    this.#ensureLoaded(locationId);
    const map = this.#cache.get(locationId);
    return ids
      .map(id => map.get(id))
      .filter(Boolean)
      .map(o => ({ ...o })); // shallow clone
  }
}

class NpcStore {
  #baseDir;
  #cache = new Map(); // locationId -> Map<npcId, npcObj>

  constructor(baseDir = path.join("scenario", "locations")) {
    this.#baseDir = baseDir;
  }

  #ensureLoaded(locationId) {
    if (this.#cache.has(locationId)) return;
    const file = path.join(this.#baseDir, locationId, "npc.json");
    const map = new Map();
    if (fs.existsSync(file)) {
      const arr = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const npc of arr) {
        const id = npc.id || npc.name;
        map.set(id, { id, ...npc });
      }
    }
    this.#cache.set(locationId, map);
  }

  get(locationId, npcId) {
    this.#ensureLoaded(locationId);
    const map = this.#cache.get(locationId);
    return map.get(npcId) || null;
  }

  getOptionsForNpc(locationId, npcId) {
    const npc = this.get(locationId, npcId);
    if (!npc) return [];
    return Array.isArray(npc.options) ? npc.options.slice() : [];
  }
  list(locationId) {
    this.#ensureLoaded(locationId);
    const map = this.#cache.get(locationId);
    return Array.from(map.values()).map(n => ({ id: n.id, name: n.name || n.id }));
  }
  listIds(locationId) {
    return this.list(locationId).map(n => n.id);
  }
}

class SceneAssembler {
  constructor({ optionStore, npcStore, locationStore }) {
    this.optionStore = optionStore;
    this.npcStore = npcStore;
    this.locationStore = locationStore; // LocationFlyweightStore
  }

  toViewDTO(scene, ctx = {}) {
    const location = this.locationStore.getDTO(scene.locationId);

    const currentNpcId = ctx.currentNpcId || null;
    const currentNpc = currentNpcId
      ? this.#npcToView(scene.locationId, currentNpcId)
      : null;

    // Explicit talk choices so user can pick an NPC
    const talkChoices = this.#talkChoices(scene, ctx);

    // Only scene options for the current scene id
    const sceneChoices = this.#sceneOptions(scene, ctx);

    // Only npc options for the current NPC (if any)
    const npcChoices = currentNpcId ? this.#npcOptions(scene, currentNpcId, ctx) : [];

    // Optional navigation choices
    const goChoices = this.#locationChoices(scene);

    const merged = this.#mergeUniqueById([
      ...talkChoices,
      ...npcChoices,
      ...sceneChoices,
      ...goChoices
    ]);

    return {
      location,
      description: scene.description,
      currentNpc,
      options: merged.map(c => ({ id: c.id, name: c.name }))
    };
  }

  // Expand option ids from scene.info.optionIds via OptionStore
  #sceneOptions(scene, ctx) {
    const ids = scene.optionIds || [];
    const raw = this.optionStore.getMany(scene.locationId, ids);
    return raw
      .filter(o => this.#passesRequirements(o, ctx))
      .map(o => ({ id: o.id, name: o.text || o.name || o.id, meta: o }));
  }

  // Expand npc.options via OptionStore
  #npcOptions(scene, npcId, ctx) {
    const ids = this.npcStore.getOptionsForNpc(scene.locationId, npcId);
    const raw = this.optionStore.getMany(scene.locationId, ids);
    return raw
      .filter(o => this.#passesRequirements(o, ctx))
      .map(o => ({ id: o.id, name: o.text || o.name || o.id, meta: o }));
  }

  // Turn scene.path into "go:<locationId>" choices; label with location name
  #locationChoices(scene) {
    const ids = scene.path || [];
    return ids.map(locId => {
      let name = locId;
      try {
        name = this.locationStore.getDTO(locId).name || locId;
      } catch { /* location may not be ensured yet */ }
      return { id: `go:${locId}`, name: name };
    });
  }

  #talkChoices(scene, ctx) {
    const npcs = this.npcStore.list(scene.locationId);
    const current = ctx.currentNpcId ? String(ctx.currentNpcId) : null;
    return npcs.map(n => ({
      id: `talk:${n.id}`,
      name: current === String(n.id) ? `Talk: ${n.name} ✓` : `Talk: ${n.name}`
    }));
  }

  #npcToView(locationId, npcId) {
    const npc = this.npcStore.get(locationId, npcId);
    if (!npc) return null;

    const startId = npc.startDialogueId || npc.startDialogId || null;
    let text = '';

    if (Array.isArray(npc.dialogue)) {
      let msg = '';
      if (startId) {
        const node = npc.dialogue.find(d => d && d.id === startId);
        if (node && typeof node.text === "string") msg = node.text;
      } else if (!text && npc.dialogue[0] && typeof npc.dialogue[0].text === "string") {
        msg = npc.dialogue[0].text;
      }
      if (msg.length) { text = `${npc.name}: ${msg}`; }
    }

    return { id: npc.id, name: npc.name || npc.id, description: npc.description, text };
  }
  #mergeUniqueById(arr) {
    const seen = new Set();
    const out = [];
    for (const it of arr) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }


  // Requirements support:
  // - scene:<id>, currentScene:<id>, not:scene:<id>, not:currentScene:<id>
  // - npc:<id>, currentNpc:<id>, not:npc:<id>, not:currentNpc:<id>
  // - existing: not:currentNpc:<id>, not:effect:<name> (left intact if you already use it elsewhere)
  #passesRequirements(opt, ctx, sceneId) {
    const reqs = Array.isArray(opt.requirements) ? opt.requirements : [];
    const currentNpcId = ctx.currentNpcId ? String(ctx.currentNpcId) : null;
    const currentSceneId = sceneId ? String(sceneId) : null;

    for (const r of reqs) {
      if (typeof r !== "string") continue;

      // Normalize helpers
      const is = (prefix) => r.startsWith(prefix + ":") ? r.slice(prefix.length + 1) : null;
      const neq = (a, b) => String(a) !== String(b);

      // Scene requirements
      let v = is("scene") ?? is("currentScene");
      if (v !== null && neq(currentSceneId, v)) return false;
      v = is("not:scene") ?? is("not:currentScene");
      if (v !== null && String(currentSceneId) === String(v)) return false;

      // NPC requirements
      v = is("npc") ?? is("currentNpc");
      if (v !== null && neq(currentNpcId, v)) return false;
      v = is("not:npc") ?? is("not:currentNpc");
      if (v !== null && String(currentNpcId) === String(v)) return false;

      // Backward‑compat for "not:currentNpc:<id>"
      if (r.startsWith("not:currentNpc:")) {
        const npc = r.slice("not:currentNpc:".length);
        if (currentNpcId && String(currentNpcId) === String(npc)) return false;
      }
    }
    return true;
  }
}

// javascript
// Handles "talk:<id>" selection to pick NPC and refresh merged options.
// Returns chosen action id or navigation "go:<locationId>" to the caller.
class SceneController {
  constructor({ view, assembler }) {
    this.view = view;
    this.assembler = assembler;
  }

  async run(scene, initialCtx = {}) {
    let ctx = { ...initialCtx }; // ctx.currentNpcId can be provided or set by talk

    while (true) {
      const dto = this.assembler.toViewDTO(scene, ctx);
      const picked = await this.view.showScene(dto);
      if (!picked) return null;

      // Talk flow: pick NPC and refresh
      if (picked.startsWith("talk:")) {
        ctx.currentNpcId = picked.split(":")[1];
        continue;
      }

      // Otherwise return the selected action (game will handle effect)
      return picked;
    }
  }
}

module.exports = { Scene, Location, LocationFlyweight, LocationFlyweightStore, SceneAssembler, OptionStore, SceneController, NpcStore };