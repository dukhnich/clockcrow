const fs = require('node:fs');
const path = require('node:path');

class Task {
    #description;
    #options;
    #score;
    constructor(descrpition, options = [], score = 0) {
        this.#description = descrpition;
        this.#options = options;
        this.#score = score;
        if (Task.none === undefined) {
            Task.none = "Game over!";
            Task.none = new Task(Task.none);
        }
    }
    get description() { return this.#description; }
    get options() { return this.#options; }
    get score() { return this.#score; }

    static load(file) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            let [desc, opt, s] = data.split(/---\r?\n/);
            let description = desc.trim();
            opt = opt.trim();
            let options = opt != ''? opt.split(/\r?\n/) : [];
            let score = parseInt(s);
            return new Task(description, options, score);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
            }
        }
        return Task.none;
    }
};

class Hint {
    #hint;
    #cost;
    constructor(hint, cost = 0) {
        this.#hint = hint;
        this.#cost = cost;
        if (Hint.none === undefined) {
            Hint.none = "No hints available";
            Hint.none = new Hint(Hint.none);
        }
    }
    get hint() { return this.#hint; }
    get cost() { return this.#cost; }

    static load(file) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            let [desc, c] = data.split(/---\r?\n/);
            let hint = desc.trim();
            let cost = parseInt(c);
            return new Hint(hint, cost);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
            }
        }
        return Hint.none;
    }
};

class Cache {
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

class FileCache extends Cache {
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

class Game {
    #cache;
    #score;
    constructor(cache, score) {
        this.#cache = cache;
        this.#score = score;
    }
    get task() { return this.#cache.currentTask; }
    getHint() {
        let hint = this.#cache.currentHint;
        if (this.#score < hint.cost) {
            return Hint.none;
        }
        this.#score -= hint.cost;
        return hint;
    }

    next(choise) {
        if (choise == 0 || choise > this.task.options.length ||
            !this.#cache.update(this.#cache.key + choise)) {
            return false;
        }
        this.#score += this.task.score;
        return true;
    }

    get history() { return this.#cache.key; }
    get level() { return this.history.length; }
    get score() { return this.#score; }
};

module.exports = { Task, Hint, Cache, FileCache, Saver, FileSaver, AutoSaver, Game };