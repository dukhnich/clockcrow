const { Observer } = require("../utils/observer.js");

class Trait {
    #name;
    #description;
    #value;
    #side; // 'light' or 'dark'
    static MIN = 0;
    static MAX = 10;
    constructor(name, description, side, value = 0) {
        this.#name = name;
        this.#description = description;
        this.#side = side;
        this.value = value;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get side() { return this.#side; }
    get value() { return this.#value; }
    set value(v) {
        this.#value = Math.max(Trait.MIN, Math.min(Trait.MAX, v));
    }
    increment(amount = 1) {
        this.value = this.#value + amount;
    }
    decrement(amount = 1) {
        this.value = this.#value - amount;
    }
}
class TraitsManager extends Observer {
    #traits;
    constructor(traits = []) {
        super();
        this.#traits = traits;
    }
    get traits() { return this.#traits; }
    getTraitByName(name) {
        return this.#traits.find(t => t.name === name);
    }

    getTraitsBySide(side) {
        return this.#traits.filter(t => t.side === side);
    }
    getTotalBySide(side) {
        return this.getTraitsBySide(side).reduce((sum, t) => sum + t.value, 0);
    }
    updateTraitValue(name, value) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.value = value;
            this.notify(trait);
            return true;
        }
        return false;
    }
    incrementTrait(name, amount = 1) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.increment(amount);
            this.notify(trait);
            return true;
        }
        return false;
    }
    decrementTrait(name, amount = 1) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.decrement(amount);
            this.notify(trait);
            return true;
        }
        return false;
    }
}
module.exports = { Trait, TraitsManager };