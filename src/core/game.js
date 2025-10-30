const { Hint } = require("./hint.js");
const { InitialState } = require("./state.js");
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
const { EffectInterpreter } = require('../utils/effectInterpreter.js');

const path = require("node:path");


class Game {
  #state;
  #view;
  #traitsManager;
  #timeManager;
  #inventory;
  #effects;
  #eventLog;

  #sceneCache;
  #movement;
  #events;
  #sceneController;
  constructor(opts = {}) {
    this.#state = opts.state || new InitialState();
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

    this.#sceneCache = new SceneCache({
      baseDir,
      jsonPool,
      optionStore,
      npcStore,
      locationStore,
      timeManager: this.#timeManager,
      start: opts.start || { locationId: "start", sceneId: this.#deriveStartSceneId(baseDir, jsonPool, "market") }
    });

    this.#movement = new MovementManager({ cache: this.#sceneCache });
    const assembler = new SceneAssembler({ optionStore, npcStore, locationStore });

    this.#events = new EventsManager();
    this.#eventLog = new EventLog();
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
    });

    this.#addListeners();
  }
  #addListeners() {
    this.#addTraitsItemListeners();
    // Navigation
    this.#events.on("go", (payload) => {
      this.#movement.go(payload);
    });

    // Advance time if the effect payload carries a time cost
    this.#events.on("effect", (eff) => {
      const t = Number(eff && eff.time);
      if (t > 0) this.#timeManager.tick(t);
    });

    // Optional: end-of-day handling (if TimeManager reports gameOver)
    this.#timeManager.subscribe((e) => {
      if (e && e.gameOver) {
        // Could set a flag or emit an event to terminate external loop if needed
        // Here we just log; the outer loop can decide to stop based on context.
        console.log("Day ended");
      }
    });
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
    const scene = this.currentScene;
    if (!scene) return null;

    this.#view.showTime({
      time: this.#timeManager.formatTime(this.#timeManager.currentTime),
      window: this.#timeManager.getTimeWindow()
    });

    const result = await this.#sceneController.run(scene, ctx);
    this.#sceneCache.applyResult(result);
    console.log(this.#traitsManager.getTraitByName('greed').dto);
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
