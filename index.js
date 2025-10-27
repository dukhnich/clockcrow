const { FileSaver, AutoSaver } = require("./src/core/saver.js");
const { Game } = require("./src/core/game.js");
const path = require("node:path");

class GameFacade {
    #saver;
    #game;
    #sceneFactory;
    constructor() {
        this.#saver = new FileSaver("lection5/examples/save.txt");
        this.#game = this.#saver.load();
        // this.#sceneFactory = new SceneFlyweightFactory({ 'DNGN': "lection11/examples/dungeon.txt" });
    }

    start() {
        return this.#sceneFactory.get('DNGN').render(this.#game.task);
    }

    next(choise) {
        let save = new AutoSaver(this.#saver, this.#game);
        this.#game.next(choise);
        return this.#sceneFactory.get('DNGN').render(this.#game.task);
    }
};

async function main() {
  const saver = new FileSaver(path.join(process.cwd(), "saves", "slot1.json"));
  const saved = saver.load();

  const game = new Game({
    start: saved?.pointer || { locationId: "start" }
  });

  const autosave = new AutoSaver(saver, game);

  for (;;) {
    const result = await autosave.after(() => game.runStep());
    if (!result || result === "exit" || (typeof result === "object" && result.exit)) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});