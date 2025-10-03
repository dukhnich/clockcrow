const { Observer } = require("../utils/observer.js");
class Item {
    #name;
    #description;
    constructor(name, description) {
        this.#name = name;
        this.#description = description;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    effect() { return null; }
};
class TraitItem extends Item {
    #traitsValues;
    constructor(name, description, traitsValues = []) {
        super(name, description);
        this.#traitsValues = traitsValues;
    }
    get traitsValues() { return this.#traitsValues; }
};

class Inventory {
    #items;
    #observer;
    constructor(items = []) {
        this.#items = items;
        this.#observer = new Observer();
    }
    get(index) { return this.#items[index]; }
    set(index, item) {
        if (!(item instanceof Item)) throw new TypeError("Only Item instances allowed");
        this.#items[index] = item;
    }
    subscribe(listener) { this.#observer.subscribe(listener); }
    unsubscribe(listener) { this.#observer.unsubscribe(listener); }
    notify(event) { this.#observer.notify(event); }
    add(item) {
        if (!(item instanceof Item)) throw new TypeError("Only Item instances allowed");
        this.#items.push(item);
        if (item instanceof TraitItem) {
            this.notify({ type: "traitItemAdded", item });
        }
        this.notify({ type: "itemAdded", item });
    }

    remove(item) {
        const ix = this.#items.indexOf(item);
        if (ix >= 0) {
            this.#items.splice(ix, 1);
            if (item instanceof TraitItem) {
                this.notify({ type: "traitItemRemoved", item });
            }
            this.notify({ type: "itemRemoved", item });
            return true;
        }
        return false;
    }
    has(item) {
        return this.#items.includes(item);
    }
    getAll() {
        return [...this.#items];
    }
    resetInventory() {
        this.#items = [];
    }
};

module.exports = { Item, TraitItem, Inventory };