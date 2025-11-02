const path = require("node:path");
const { FileSaver, AutoSaver } = require("./saver.js");
const { Game } = require("./game.js");
const { FinishState } = require("./state.js");
const { FileTextCache } = require("../utils/file-text-cache.js");

class GameFacade {
  #saver;
  #game;
  #autosave;
  #bannerShown = false;
  #textCache;
  constructor(opts = {}) {
    const saveFile = opts.saveFile || path.join(process.cwd(), "saves", "slot1.json");
    this.#saver = opts.saver || new FileSaver(saveFile);
    this.#textCache = opts.textCache || new FileTextCache();

    const saved = this.#saver.load();
    this.#game = opts.game || new Game({
      start: saved?.pointer || opts.start || { locationId: "start" },
      scene: opts.scene // optional stores injection for tests or custom wiring
    });
    if (saved?.time != null) {
      this.#game.timeManager.setTime(saved.time);
    }
    if (saved?.traits) {
      this.#game.setTraitsFromSnapshot(saved.traits);
    }
    if (saved?.domainEvents) {
      this.#game.setDomainEventsFromSnapshot(saved.domainEvents);
    }
    if (saved?.inventory) {
      this.#game.inventory.applyCountsSnapshot(saved.inventory);
    }
    if (saved?.world) {
      this.#game.applyWorldSnapshot(saved.world);
    }

    this.#autosave = new AutoSaver(this.#saver, this.#game);
  }
  async #printBannerOnce() {
    if (this.#bannerShown) return;
    const file = path.join(process.cwd(), "scenario", "banner.txt");
    const banner = this.#textCache.readText(file, "");
    if (banner && banner.trim().length > 0) {
      this.#game?.view?.clear?.();
      await this.#game?.view?.showBanner?.(banner);
    }
    this.#bannerShown = true;
  }

  get game() { return this.#game; }
  get saver() { return this.#saver; }
  get currentScene() { return this.#game.currentScene; }
  get currentLocationId() { return this.#game.currentLocationId; }

  async step(ctx = {}) {
    return this.#autosave.after(() => this.#game.runStep(ctx));
  }

  async run(ctx = {}) {
    await this.#printBannerOnce();
    for (;;) {
      const result = await this.step(ctx);
      if (!result || result === "exit" || (typeof result === "object" && result.exit)) {
        this.#game.changeState(new FinishState());
        break;
      };
    }
    return true;
  }

  save() {
    return this.#saver.save(this.#game);
  }
}

module.exports = { GameFacade };