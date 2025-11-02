const { RequirementInterpreter } = require("../utils/interpreters/requirementsInterpreter");
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
  get npcIds() {
    return Array.isArray(this.info.npcIds) ? this.info.npcIds.slice() : [];
  }

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
      currentNpc,                      // { id?, name?, text? } | null
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
  #req
  constructor({ optionStore, npcStore, locationStore, req = null }) {
    this.optionStore = optionStore;
    this.npcStore = npcStore;
    this.locationStore = locationStore;
    this.#req = req || new RequirementInterpreter();
  }
  get requirementInterpreter() { return this.#req; }

  buildChoices(scene, ctx = {}) {
    const talkChoices = this.#talkChoices(scene, ctx);
    const sceneChoices = this.#sceneOptions(scene, ctx);
    const allowed = scene.npcIds || [];
    const chosenNpcId = (ctx.currentNpcId && (!allowed.length || allowed.includes(String(ctx.currentNpcId))))
      ? ctx.currentNpcId
      : null;
    const npcChoices = chosenNpcId ? this.#npcOptions(scene, chosenNpcId, ctx) : [];

    const merged = this.#mergeUniqueById([
      ...talkChoices,
      ...npcChoices,
      ...sceneChoices,
    ]);

    if (!merged.some(c => c.id === "inventory")) {
      merged.push({ id: "inventory", name: "Оглянути своє майно" });
    }

    if (!merged.some(c => c.id === "exit")) {
      merged.push({ id: "exit", name: "Exit" });
    }

    return merged;
  }

  buildPathChoices(scene, ctx = {}, baseGoOpt = null) {
    const ids = Array.isArray(scene.path) ? scene.path : [];
    const result = [];
    for (const locId of ids) {
      const id = String(locId);
      if (!this.locationStore.has(id)) continue;
      const dto = this.locationStore.getDTO(id);
      result.push({
        id: `go:${id}`,
        name: dto.name || id,
        meta: {
          id: `go:${id}`,
          text: dto.name || id,
          time: (baseGoOpt && Number.isFinite(Number(baseGoOpt.time))) ? Number(baseGoOpt.time) : undefined
        }
      });
    }
    return this.#mergeUniqueById(result);
  }

  toViewDTO(scene, ctx = {}) {
    const location = this.locationStore.getDTO(scene.locationId);

    const allowed = scene.npcIds || [];
    const currentNpcId = (ctx.currentNpcId && (!allowed.length || allowed.includes(String(ctx.currentNpcId))))
      ? ctx.currentNpcId
      : null;

    const currentNpc = currentNpcId
      ? this.#npcToView(scene.locationId, currentNpcId)
      : null;

    const merged = this.buildChoices(scene, ctx);

    return {
      location,
      description: scene.description,
      currentNpc,
      options: merged.map(c => ({ id: c.id, name: c.name }))
    };
  }

  #getOptions(scene, ctx, ids) {
    const raw = this.optionStore.getMany(scene.locationId, ids);
    const env = { sceneId: scene.id, locationId: scene.locationId, currentNpcId: ctx.currentNpcId || null, path: scene.path || [] };
    return raw.filter(o => this.#req.passes(o.requirements, env))
      .map(o => ({ id: o.id, name: o.text || o.name || o.id, meta: o }));
  }

  #sceneOptions(scene, ctx) {
    const ids = scene.optionIds || [];
    return this.#getOptions(scene, ctx, ids);
  }

  // Expand npc.options via OptionStore
  #npcOptions(scene, npcId, ctx) {
    const ids = this.npcStore.getOptionsForNpc(scene.locationId, npcId);
    return this.#getOptions(scene, ctx, ids);
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

  #filterNpcs(scene, ctx, listIds) {
    const env = {
      sceneId: scene.id,
      locationId: scene.locationId,
      currentNpcId: ctx.currentNpcId || null,
      path: scene.path || [],
    };
    const result = [];
    listIds.forEach(id => {
      const npc = this.npcStore.get(scene.locationId, id);
      if (npc && Boolean(this.#req.passes(npc.requirements, env)) && !result.includes(npc)) {
        result.push(npc);
      }
    });
    return result;
  }

  #talkChoices(scene, ctx) {
    const ids = scene.npcIds || [];
    const npcs = this.#filterNpcs(scene, ctx, ids);
    const current = ctx.currentNpcId ? String(ctx.currentNpcId) : null;
    return npcs.map(n => ({
      id: `talk:${n.id}`,
      name: current === String(n.id) ? `Talk: ${n.name} ✓` : `Talk: ${n.name}`,
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
}

class SceneController {
  #timeManager
  constructor({ view, assembler, events, timeManager, effects, inventory, itemStore }) {
    this.#timeManager = timeManager;
    this.view = view;
    this.assembler = assembler;
    this.events = events;
    this.effects = effects;
    this.inventory = inventory;
    this.itemStore = itemStore;
  }

  async run(scene, initialCtx = {}) {
    let ctx = { ...initialCtx }; // ctx.currentNpcId can be provided or set by talk

    while (true) {
      const dto = this.assembler.toViewDTO(scene, ctx);
      const choices = this.assembler.buildChoices(scene, ctx);
      const picked = await this.view.showScene(dto);
      if (!picked) return null;

      // Talk flow: pick NPC and refresh
      if (picked.startsWith("talk:")) {
        ctx.currentNpcId = picked.split(":")[1];
        continue;
      }
      if (picked === "inventory") {
        const snap = this.inventory?.getSnapshot?.() || { counts: {}, items: [] };
        const friendlyCounts = {};
        for (const [id, qty] of Object.entries(snap.counts || {})) {
          const dto = this.itemStore?.getDTO?.(id);
          const label = dto?.name || id;
          friendlyCounts[label] = qty;
        }
        await this.view.showInventory({ ...snap, counts: friendlyCounts });
        continue;
      }

      if (picked === "go") {
        const baseGoChoice = choices.find(c => c.id === "go");
        const baseOpt = baseGoChoice && baseGoChoice.meta ? baseGoChoice.meta : null;
        const pathChoices = this.assembler.buildPathChoices(scene, ctx, baseOpt);
        if (!pathChoices.length) {
          await this.view.showMessage("No available paths.");
          continue;
        }
        const selected = await this.view.showPath(pathChoices, { includeBack: true });
        if (!selected || selected === "back") continue;
        const chosen = pathChoices.find(c => c.id === selected) || null;
        const meta = chosen && chosen.meta ? chosen.meta : null;
        if (meta && meta.result) await this.view.showChoiceResult(meta);
        const locId = selected.split(":")[1];
        const timeCost = Number.isFinite(Number(meta?.time))
          ? Number(meta.time)
          : (Number.isFinite(Number(baseOpt?.time)) ? Number(baseOpt.time) : undefined);
        if (meta && (meta.effect != null || meta.effects != null)) {
          const effectDef = meta.effect != null ? meta.effect : meta.effects;
          const res = await this.effects?.interpret(effectDef, { timeCost, kind: 'travel' });
          return res ?? null;
        } else {
          const res = await this.effects?.interpret(`go:${locId}`, { timeCost, kind: 'travel' });
          // If interpreter returns nothing, still return a navigation payload
          return res ?? { locationId: locId };
        }
        continue;
      }

      const choice = choices.find(c => c.id === picked);
      const opt = choice && choice.meta ? choice.meta : null;
      if (opt) {
        if (opt.result) await this.view.showChoiceResult(opt);

        const effectDef = opt.effect != null ? opt.effect : opt.effects;
        const res = await this.effects?.interpret(effectDef, { timeCost: opt.time });
        if (res != null) return res;
      }

      // Otherwise return the selected action (game will handle effect)
      return picked;
    }
  }
}

module.exports = { Scene, SceneAssembler, SceneController };