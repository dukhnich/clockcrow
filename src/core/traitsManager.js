import { Observer } from "../utils/observer.js";

export class Trait {
    #name;
    #description;
    #value;
    constructor(name, description, value = 0) {
        this.#name = name;
        this.#description = description;
        this.#value = value;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get value() { return this.#value; }
    set value(v) { this.#value = v; }
}
export class TraitsManager extends Observer {
    #traits;
    constructor(traits = []) {
        super();
        this.#traits = traits;
    }
    get traits() { return this.#traits; }
    getTraitByName(name) {
        return this.#traits.find(t => t.name === name);
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
}
export default { Trait, TraitsManager };