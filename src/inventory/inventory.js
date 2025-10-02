class Item {
    #name;
    #description;
    constructor(name, description) {
        this.#name = name;
        this.#description = description;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
};
class TraitItem extends Item {
    #traitsValues;
    constructor(name, description, traitsValues = []) {
        super(name, description);
        this.#traitsValues = traitsValues;
    }
};

class Inventory {
    #items;
    constructor(items) {
        this.#items = items;
    }
    get(index) { return this.#items[index]; }
    set(index, item) { this.#items[index] = item; }
    add(item) { this.#items.push(item); }
    remove(item) {
        const ix = this.#items.indexOf(item);
        if (ix >= 0) {
            this.#items.splice(ix, 1);
            return true;
        }
        return false;
    }
    has(item) {
        return this.#items.includes(item);
    }
};

export { Item, TraitItem, Inventory };