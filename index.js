const { FileSaver, AutoSaver } = require("./src/core/saver.js");
const { Game } = require("./src/core/game.js");

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
  // Optional custom start:
  const game = new Game({ start: { locationId: 'start' } });
  // const game = new Game();

  // Minimal loop: run scenes until exit/falsy or Ctrl+C
  // Adjust the stop condition to your controller's contract if needed.
  // Each iteration shows the scene via CLIInquirerView and applies the result.
  for (;;) {
    const result = await game.runStep();
    if (!result || result === 'exit' || (typeof result === 'object' && result.exit)) break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});