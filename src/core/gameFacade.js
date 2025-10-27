const path = require("node:path");
const { FileSaver, AutoSaver } = require("./saver.js");
const { Game } = require("./game.js");

class GameFacade {
  #saver;
  #game;
  #autosave;

  constructor(opts = {}) {
    const saveFile = opts.saveFile || path.join(process.cwd(), "saves", "slot1.json");
    this.#saver = opts.saver || new FileSaver(saveFile);

    const saved = this.#saver.load();
    this.#game = opts.game || new Game({
      start: saved?.pointer || opts.start || { locationId: "start" },
      scene: opts.scene // optional stores injection for tests or custom wiring
    });

    this.#autosave = new AutoSaver(this.#saver, this.#game);
  }

  get game() { return this.#game; }
  get saver() { return this.#saver; }
  get currentScene() { return this.#game.currentScene; }
  get currentLocationId() { return this.#game.currentLocationId; }
  get history() { return this.#game.history; }

  async step(ctx = {}) {
    return this.#autosave.after(() => this.#game.runStep(ctx));
  }

  async run(ctx = {}) {
    for (;;) {
      const result = await this.step(ctx);
      if (!result || result === "exit" || (typeof result === "object" && result.exit)) break;
    }
    return true;
  }

  save() {
    return this.#saver.save(this.#game);
  }
}

module.exports = { GameFacade };