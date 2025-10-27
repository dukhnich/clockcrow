const fs = require("node:fs");

class Hint {
    #hint;
    #cost;
    constructor(hint, cost = 0) {
        this.#hint = hint;
        this.#cost = cost;
        if (Hint.none === undefined) {
            Hint.none = ["No hints available"];
            Hint.none = new Hint(Hint.none);
        }
    }
    get hint() { return this.#hint; }
    get cost() { return this.#cost; }

    static load(file) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            let [desc, c] = data.split(/---\r?\n/);
            let hint = desc.trim().split(/\r?\n/);
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

module.exports = { Hint };
