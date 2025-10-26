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

const fs = require("node:fs");
const path = require("node:path");

const { CLIInquirerView } = require("./src/view/view.js");
const { FileJsonCache } = require("./src/scene/file-json-cache.js");
const { OptionStore } = require("./src/scene/option-store.js");
const { NpcStore } = require("./src/scene/npc-store.js");
const { LocationFlyweightStore } = require("./src/scene/location.js");

const {
  Scene,
  SceneAssembler,
  SceneController
} = require("./src/scene/scene.js");

async function main() {
  const jsonPool = new FileJsonCache();
  const baseDir = path.join(process.cwd(), "scenario", "locations");
  const optionStore = new OptionStore(baseDir, jsonPool);
  const npcStore = new NpcStore(baseDir, jsonPool);
  const locationStore = new LocationFlyweightStore();

  const locationId = "market";

  // Load location info.json with embedded scenes
  const info = jsonPool.readJson(path.join(baseDir, locationId, "info.json"), {});
  locationStore.ensure(locationId, { title: info.name || info.title || locationId, background: info.background });

  const startSceneId = info.startSceneId
    || (Array.isArray(info.scenes) && info.scenes[0] && info.scenes[0].id)
    || null;
  if (!startSceneId) throw new Error("startSceneId not found");

  const sceneObj = (Array.isArray(info.scenes) ? info.scenes.find(s => s && s.id === startSceneId) : null) || {};

  // Build Scene from the selected scene object
  const scene = new Scene(startSceneId, locationId, {
    description: Array.isArray(sceneObj.description) ? sceneObj.description : (sceneObj.description || ""),
    optionIds: Array.isArray(sceneObj.optionIds) ? sceneObj.optionIds : [],
    path: Array.isArray(sceneObj.path) ? sceneObj.path : (Array.isArray(info.path) ? info.path : [])
  });

  // Wire view + controller
  const view = new CLIInquirerView();
  const assembler = new SceneAssembler({ optionStore, npcStore, locationStore });
  const controller = new SceneController({ view, assembler });

  // Run one interaction:
  // - You will see background from `scenario/locations/market/background.txt`
  // - "Talk: <npc>" entries from `npc.json`
  // - Scene options from `options.json`
  // - Optional "go:<id>" from info.path
  const result = await controller.run(scene, /* initialCtx */ {});
  console.log("\nChosen action:", result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
