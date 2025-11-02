const { Hint } = require("./hint.js");
const { NewGameState, ResultsState, GameOverState } = require("./state.js");
const { Inventory } = require("../inventory/inventory.js");
const { TimeManager } = require("./timeManager.js");
const { TraitsManager } = require("../traits/traitsManager.js");
const { TraitsStore } = require("../traits/traitsStore.js");
const { CLIInquirerView } = require("../view/view.js");

const { SceneCache } = require("./cache.js");
const { SceneController, SceneAssembler } = require("../scene/scene.js");
const { FileJsonCache } = require("../utils/file-json-cache.js");
const { OptionStore } = require("../scene/option-store.js");
const { NpcStore } = require("../scene/npc-store.js");
const { LocationFlyweightStore } = require("../scene/location.js");
const { EventLog } = require("../utils/events/eventLog.js");
const { EventsManager } = require("../utils/events/eventsManager.js");
const { MovementManager } = require("./movementManager.js");
const { EffectInterpreter } = require('../utils/interpreters/effectInterpreter.js');
const { RequirementInterpreter } = require("../utils/interpreters/requirementsInterpreter");
const { WorldState } = require("./worldState.js");

const path = require("node:path");


class Game {
  #start
  #state;
  #view;
  #traitsManager;
  #timeManager;
  #inventory;
  #effects;
  #eventLog;
  #world;
  #initialInventory;

  #sceneCache;
  #movement;
  #events;
  #sceneController;
  #finalPtr;
  #gameOverHandled = false;
  constructor(opts = {}) {
    this.#state = opts.state || new NewGameState();
    this.#view = opts.view || new CLIInquirerView();
    this.#timeManager = opts.timeManager || new TimeManager();
    this.#inventory = opts.inventory || new Inventory();

    const traitsStore = new TraitsStore();
    const traitModels = traitsStore.getAll();
    this.#traitsManager = opts.traitsManager || new TraitsManager(traitModels);

    const baseDir = (opts.scene && opts.scene.baseDir) || path.join(process.cwd(), "scenario", "locations");
    const jsonPool = (opts.scene && opts.scene.jsonPool) || new FileJsonCache();
    const optionStore = (opts.scene && opts.scene.optionStore) || new OptionStore(baseDir, jsonPool);
    const npcStore = (opts.scene && opts.scene.npcStore) || new NpcStore(baseDir, jsonPool);
    const locationStore = (opts.scene && opts.scene.locationStore) || new LocationFlyweightStore();

    this.#world = new WorldState();
    const initial = this.#readInitial(jsonPool);
    this.#start = opts.start || initial.start || { locationId: "start", sceneId: this.#deriveStartSceneId(baseDir, jsonPool, "market") };
    this.#initialInventory = Array.isArray(opts.initialInventory) ? opts.initialInventory : (initial.inventory || null);

    this.#sceneCache = new SceneCache({
      baseDir,
      jsonPool,
      optionStore,
      npcStore,
      locationStore,
      timeManager: this.#timeManager,
      start: this.#start
    });

    this.#movement = new MovementManager({ cache: this.#sceneCache });
    this.#events = new EventsManager();
    this.#eventLog = new EventLog();

    this.#finalPtr = (opts.final && typeof opts.final === "object")
      ? { locationId: opts.final.locationId, sceneId: opts.final.sceneId }
      : { locationId: "townhall", sceneId: "TH02" };

    const req = new RequirementInterpreter({
      timeManager: this.#timeManager,
      eventLog: this.#eventLog,
      traits: this.#traitsManager,
      inventory: this.#inventory,
      locationStore,
      world: this.#world,
    });
    const assembler = new SceneAssembler({
      optionStore,
      npcStore,
      locationStore,
      req,
    });

    this.#effects = new EffectInterpreter({
      events: this.#events,
      traits: this.#traitsManager,
      time: this.#timeManager,
      eventLog: this.#eventLog,
    });
    this.#sceneController = new SceneController({
      view: this.#view,
      assembler,
      events: this.#events,
      timeManager: this.#timeManager,
      effects: this.#effects,
      inventory: this.#inventory,
    });

    if (this.#initialInventory) {
      this.#inventory.applyCountsSnapshot(this.#initialInventory);
    }
    this.#syncSceneInventory();

    this.#addListeners();
  }

  #syncSceneInventory() {
    const scene = this.#sceneCache.currentScene();
    if (!scene) return;
    const inventory = scene.info.inventory;
    this.#world.applySceneInventory(scene.locationId, inventory);
  }

  #readInitial(jsonPool) {
    const file = path.join(process.cwd(), "scenario", "initial.json");
    let data = {};
    try {
      data = jsonPool.readJson(file) || {};
    } catch {
      data = {};
    }
    const start = (data && typeof data.startLocation === "object")
      ? { locationId: data.startLocation.locationId, sceneId: data.startLocation.sceneId }
      : null;
    const final = (data && typeof data.finalLocation === "object")
      ? { locationId: data.finalLocation.locationId, sceneId: data.finalLocation.sceneId }
      : null;
    const inventory = Array.isArray(data.inventory)
      ? data.inventory
        .filter(e => e && e.id)
        .map(e => ({ id: String(e.id), qty: Number.isFinite(Number(e.qty)) ? Number(e.qty) : 1 }))
      : null;
    return { start, final, inventory };
  }

  navigate(payload) {
    this.#events.emit("go", payload);
  }
  handleNewGame() {
    this.#eventLog.clear();
    this.#traitsManager.resetTraits();
    if (typeof this.#timeManager.reset === "function") {
      this.#timeManager.reset();
    } else if (typeof this.#timeManager.setTime === "function") {
      this.#timeManager.setTime(8);
    }
    this.#world.reset();
    this.#inventory.resetInventory();
    this.#inventory.resetCounts();
    if (this.#initialInventory) {
      this.#inventory.applyCountsSnapshot(this.#initialInventory);
    }
    this.#gameOverHandled = false;
    // const start = this.#start || { locationId: "start" };
    this.navigate({ locationId: "start" });
  }

  async handleHearResult() {
    const base = this.#traitsManager.computeTraitsResult();
    const catalog = this.#sceneCache.getResultsCatalog();
    const enriched = this.#enrichTraitsResult(base, catalog);
    this.#view.showTraitsResult(enriched);
    this.#view.exit();
  }
  didHandleGameOver() {
    return this.#gameOverHandled === true;
  }
  handleGameOver() {
    if (this.#gameOverHandled) return;
    this.#gameOverHandled = true;

    this.#eventLog.add("effect:gameOver");

    const { locationId, sceneId } = this.#finalPtr || {};
    this.navigate({ locationId, sceneId });
  }

  #addListeners() {
    this.#addTraitsItemListeners();
    // Navigation
    this.#events.on("go", (payload) => {
      this.#movement.go(payload);
      this.#syncSceneInventory();
    });

    this.#events.on("effect", (eff) => {
      const t = Number(eff && eff.time);
      if (t > 0) this.#timeManager.tick(t);
    });

    this.#events.on("hearResult", () => {
      this.changeState(new ResultsState());
    });

    this.#events.on("newGame", () => {
      this.changeState(new NewGameState());
    });

    this.#timeManager.subscribe((e) => {
      if (e?.gameOver) {
        this.changeState(new GameOverState());
      }
    });
    this.#events.on("add", (e) => {
      const args = Array.isArray(e?.args) ? e.args : [];
      const [target, id, qtyRaw] = args;
      const qty = Number(qtyRaw);
      if (target === "player" && id) {
        this.#inventory.addById(id, Number.isFinite(qty) ? qty : 1);
      } else if (target === "location" && id) {
        const loc = this.currentLocationId;
        this.#world.addLocationItem(loc, id);
      }
    });
    this.#events.on("remove", (e) => {
      const args = Array.isArray(e?.args) ? e.args : [];
      const [target, id, qtyRaw] = args;
      const qty = Number(qtyRaw);
      if (target === "player" && id) {
        this.#inventory.removeById(id, Number.isFinite(qty) ? qty : 1);
      } else if (target === "location" && id) {
        const loc = this.currentLocationId;
        this.#world.removeLocationItem(loc, id);
      }
      // ignore currentNpc removal for now
    });
  }
  #enrichTraitsResult(res, cat) {
    const result = { ...res };
    const sides = (cat && cat.sides) || {};
    const traits = (cat && cat.traits) || {};
    const defaults = (cat && cat.defaults) || {};

    const sideMeta = sides[result.dominantSide] || null;
    const traitId = result.selectedTrait || null;
    const traitMeta = traitId ? (traits[traitId] || null) : null;

    result.meta = {
      side: sideMeta ? {
        id: result.dominantSide,
        name: sideMeta.name || result.dominantSide,
        description: sideMeta.description || [],
        epilogue: sideMeta.epilogue || []
      } : null,
      trait: traitMeta ? {
        id: traitMeta.id || traitId,
        name: traitMeta.name || traitId,
        description: traitMeta.description || [],
        epilogue: traitMeta.epilogue || [],
        character: traitMeta.character || null
      } : null,
      defaults: defaults || {}
    };
    return result;
  }
  #addTraitsItemListeners() {
      this.#inventory.subscribe((event) => {
          if (event.type === "traitItemAdded") {
              event.item.traitsValues.forEach(({ traitName, value }) => {
                  this.#traitsManager.incrementTrait(traitName, value);
              });
          }
          if (event.type === "traitItemRemoved") {
              event.item.traitsValues.forEach(({ traitName, value }) => {
                  this.#traitsManager.decrementTrait(traitName, value);
              });
          }
      });
  }

  // Derive start scene from location info.json
  #deriveStartSceneId(baseDir, jsonPool, locationId) {
    const infoPath = path.join(baseDir, locationId, "info.json");
    const info = jsonPool.readJson(infoPath, {});
    return info.startSceneId
      || (Array.isArray(info.scenes) && info.scenes[0] && info.scenes[0].id)
      || "start";
  }

  // getHint() {
  //     let hint = this.#cache.currentHint;
  //     if (this.#score < hint.cost) {
  //         return Hint.none;
  //     }
  //     this.#score -= hint.cost;
  //     return hint;
  // }

  get state() { return this.#state; }
  get view() { return this.#view; }
  get traitsManager() { return this.#traitsManager; }
  get timeManager() { return this.#timeManager; }
  get eventLog() { return this.#eventLog; }
  get domainEventsSnapshot() {
    return this.#eventLog.toArray();
  }
  get traitsSnapshot() {
    return Object.fromEntries((this.#traitsManager.traits || []).map(t => [t.name, t.value]));
  }
  get inventory() { return this.#inventory; }
  get currentScene() { return this.#sceneCache.currentScene(); }
  get currentLocationId() { return (this.#sceneCache.pointer || {}).locationId; }
  get history() { return this.#sceneCache.history; }
  setTraitsFromSnapshot(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const [name, value] of Object.entries(obj)) {
      this.#traitsManager.updateTraitValue(name, Number(value));
    }
  }
  setDomainEventsFromSnapshot(arr) {
    this.#eventLog.load(arr);
  }
  async runStep(ctx = {}) {
    this.#view.clear();
    const scene = this.currentScene;
    if (!scene) return null;

    this.#view.showTime({
      time: this.#timeManager.formatTime(this.#timeManager.currentTime),
      window: this.#timeManager.getTimeWindow()
    });

    const result = await this.#sceneController.run(scene, ctx);
    this.#sceneCache.applyResult(result);
    console.log('result')
    this.#syncSceneInventory();
    return result;
  }

  changeState(newState) {
    if (this.#state) {
        this.#state.onExit(this);
    }
    this.#state = newState;
    if (this.#state) {
        this.#state.onEnter(this);
      }
  }
};

module.exports = { Game };
