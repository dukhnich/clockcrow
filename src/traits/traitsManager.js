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
        this.#value = value;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get side() { return this.#side; }
    get value() { return this.#value; }
    set value(v) {
        this.#value = Math.max(Trait.MIN, Math.min(Trait.MAX, v));
    }
    get dto() {
        return {
            name: this.#name,
            description: this.#description,
            side: this.#side,
            value: this.#value,
        };
    }
    increment(amount = 1) {
        this.#value = this.#value + amount;
    }
    decrement(amount = 1) {
        this.#value = this.#value - amount;
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
        return this.getTraitsBySide(side).reduce((sum, t) => {
          console.log(side, t.name, t.value);
          return sum + t.value;
        }, 0);
    }
  computeTraitsResult() {
    const all = this.traits || [];

    const totals = all.reduce((acc, t) => {
      acc[t.side] = acc[t.side] ? acc[t.side] + t.value : t.value;
      return acc;
    });

    const dominantSide = Object.entries(totals).reduce((dom, [side, total]) => {
      if (total > (totals[dom] || 0)) {
        return side;
      }
      return dom;
    }, null);

    let maxVal = -Infinity;
    let topTraits = [];
    all.forEach((t) => {
      if (t.value > maxVal) {
        maxVal = t.value;
        topTraits = [t.name];
      } else if (t.value === maxVal) {
        topTraits.push(t.name);
      }
    })
    const selectedTrait = topTraits.length
      ? topTraits[Math.floor(Math.random() * topTraits.length)]
      : null;

    return {
      totals,
      dominantSide,
      topTraits,
      selectedTrait,
      topValue: Number.isFinite(maxVal) ? maxVal : 0
    };
  }
    updateTraitValue(name, value) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.value = value;
            this.notify(trait.dto);
            return true;
        }
        return false;
    }
    incrementTrait(name, amount = 1) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.increment(amount);
            this.notify(trait.dto);
            return true;
        }
        return false;
    }
    decrementTrait(name, amount = 1) {
        const trait = this.getTraitByName(name);
        if (trait) {
            trait.decrement(amount);
            this.notify(trait.dto);
            return true;
        }
        return false;
    }
    resetTraits() {
        this.#traits.forEach(t => {
            t.value = 0;
            this.notify(t.dto);
        });
    }
}
module.exports = { Trait, TraitsManager };