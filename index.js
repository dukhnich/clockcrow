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
const {
  Scene,
  LocationFlyweightStore,
  OptionStore,
  NpcStore,
  SceneAssembler,
  SceneController
} = require("./src/scene/scene.js");

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function loadLocationInfo(baseDir, locationId) {
  const dir = path.join(baseDir, locationId);
  const info = readJsonSafe(path.join(dir, "info.json"), {});
  return {
    title: info.title || info.name || locationId,
    description: info.description || "",
    path: Array.isArray(info.path) ? info.path : [],
    startSceneId: info.startSceneId || "center",
    // sceneOptions shape in info.json:
    // { "<sceneId>": ["optA","optB"], ... }
    sceneOptions: (info.sceneOptions && typeof info.sceneOptions === "object") ? info.sceneOptions : {}
  };
}

async function main() {
  const baseDir = path.join(process.cwd(), "scenario", "locations");
  const locationId = "market";

  // Load location info.json with embedded scenes
  const info = readJsonSafe(path.join(baseDir, locationId, "info.json"), {});
  if (!info || typeof info !== "object") throw new Error("Invalid location info.json");

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

  // Stores and flyweights
  const optionStore = new OptionStore(baseDir);
  const npcStore = new NpcStore(baseDir);
  const locationStore = new LocationFlyweightStore();

  // Ensure location; CLIInquirerView will auto-load `background.txt` by id
  locationStore.ensure(locationId, { title: info.name || info.title || locationId, background: info.background });

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
