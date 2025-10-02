import { Hint } from "./hint.js";

export class Cache {
    #key;
    #tasks;
    #hints;
    constructor(key) {
        this.#key = key;
        this.#tasks = new Map();
        this.#hints = new Map();
    }
    get key() { return this.#key; }
    get currentTask() { return this.task(this.#key); }
    get currentHint() { return this.hint(this.#key); }
    task(key) { let t = this.#tasks.get(key); return t != null? t : Task.none; }
    hint(key) { let h = this.#hints.get(key); return h != null? h : Hint.none; }
    update(key) {
        if (this.#key === key) {
            return false;
        }
        this.#key = key;

        let switchCache = (cache, key) => {
            let value = cache.get(key);
            if (value == null) {
                cache.clear();
                return false;
            }
            cache = new Map([[key, value]]);
            return true;
        };
        if (!switchCache(this.#tasks, this.#key)) {
            this.loadTask(this.#key);
        }
        if (!switchCache(this.#hints, this.#key)) {
            this.loadHint(this.#key);
        }
        for (let i = 1; i <= this.currentTask.options.length; ++i) {
            let key = this.#key + i;
            this.loadTask(key);
            this.loadHint(key);
        }
        return true;
    }

    loadTask(key) { return null; }
    loadHint(key) { return null; }
    addTask(key, task) { this.#tasks.set(key, task); }
    addHint(key, hint) { this.#hints.set(key, hint); }
};

export class FileCache extends Cache {
    static #TASK = "task";
    static #HINT = "hint";
    static #EXT = ".txt";
    #dir;
    constructor(dir, key) {
        super("");
        this.#dir = dir;
        this.update(key);
    }

    loadTask(key) {
        let task = Task.load(this.#dir + "/" + FileCache.#TASK + key + FileCache.#EXT);
        this.addTask(key, task);
        return task;
    }
    loadHint(key) {
        let hint = Hint.load(this.#dir + "/" + FileCache.#HINT + key + FileCache.#EXT);
        this.addHint(key, hint);
        return hint;
    }
};

export default { Cache, FileCache };
