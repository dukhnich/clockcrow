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
      .filter(o => this.#passesRequirements(o, ctx, scene.id))
      .map(o => ({ id: o.id, name: o.text || o.name || o.id, meta: o }));
  }

  // Expand npc.options via OptionStore
  #npcOptions(scene, npcId, ctx) {
    const ids = this.npcStore.getOptionsForNpc(scene.locationId, npcId);
    const raw = this.optionStore.getMany(scene.locationId, ids);
    return raw
      .filter(o => this.#passesRequirements(o, ctx, scene.id))
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

module.exports = { Scene, SceneAssembler, SceneController };