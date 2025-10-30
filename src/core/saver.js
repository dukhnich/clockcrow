const path = require("node:path");
const fs = require("node:fs");

class Saver {
  save(game) { return false; };
  load() { return null; }
};

class FileSaver extends Saver {
  #file;
  constructor(file) {
      super();
      this.#file = file;
  }
  get dir() { return path.dirname(this.#file); }
  get file() { return this.#file; }
  isFileExists() { return fs.existsSync(this.#file); }

  save(game) {
    try {
      const scene = game.currentScene;
      const tm = game.timeManager;
      const data = {
        version: 1,
        pointer: {
          locationId: game.currentLocationId || null,
          sceneId: scene ? scene.id : null
        },
        traits: game.traitsSnapshot || {},
        domainEvents: game.domainEventsSnapshot || [],
      };
      if (typeof tm?.currentTime === "number") {
        data.time = tm.currentTime;
      }
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.#file, JSON.stringify(data, null, 2), "utf8");
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
  load() {
    try {
      const raw = fs.readFileSync(this.#file, "utf8");
      const data = JSON.parse(raw);
      if (!data || !data.pointer) return null;
      return data; // { version, pointer, time?, traits?, domainEvents? }
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error(err);
      }
      return null;
    }
  }
};

class AutoSaver {
  #saver;
  #game;
  constructor(saver, game) {
    this.#saver = saver;
    this.#game = game;
  }
  async after(fn) {
    try {
      return await fn();
    } finally {
      this.#saver.save(this.#game);
    }
  }
};

module.exports = { Saver, FileSaver, AutoSaver };
