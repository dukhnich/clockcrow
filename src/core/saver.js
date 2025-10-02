import path from "node:path";
import fs from "node:fs";
import { Game } from "./game.js";
import { FileCache } from "./cache.js";

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
        let content = game.history + "\n" + game.score;
        try {
            fs.writeFileSync(this.#file, content);
            return true;
        } catch (err) {
            console.error(err);
        }
        return false;
    }
    load() {
        try {
            const data = fs.readFileSync(this.#file, 'utf8');
            let [key, strScore] = data.split(/\r?\n/);
            let cache = new FileCache(this.dir, key);
            let score = parseInt(strScore);
            return new Game(cache, score);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
            }
        }
        let cache = new FileCache(this.dir, "1");
        let score = cache.currentTask.score;
        return new Game(cache, score);
    }
};

class AutoSaver {
    #saver;
    #game;
    constructor(saver, game) {
        this.#saver = saver;
        this.#game = game;
    }
    after(fn) {
        try {
            fn();
        } finally {
            this.#saver.save(this.#game);
        }
    }
};

export default { Saver, FileSaver, AutoSaver };
