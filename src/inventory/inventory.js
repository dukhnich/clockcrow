const { Observer } = require("../utils/observer.js");
class Item {
    #name;
    #description;
    #effect
    constructor(name, description, effect) {
        this.#name = name;
        this.#description = description;
        this.#effect = effect;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get effect() { return this.#effect; }
};
class TraitItem extends Item {
    #traitsValues;
    constructor(name, description, effect, traitsValues = []) {
        super(name, description, effect);
        this.#traitsValues = traitsValues;
    }
    get traitsValues() { return this.#traitsValues; }
};

class Inventory {
  #items;
  #observer;
  #counts;
  constructor(items = []) {
    this.#items = items;
    this.#observer = new Observer();
    this.#counts = new Map();
  }
  addById(id, qty = 1) {
    const key = String(id);
    const n = Number(qty);
    const delta = Number.isFinite(n) ? n : 1;
    const current = this.#counts.get(key) || 0;
    const next = current + delta;
    this.#counts.set(key, Math.max(0, next));
    this.notify({ type: "countChanged", id: key, qty: this.#counts.get(key) });
    return this.#counts.get(key);
  }
  removeById(id, qty = 1) {
    return this.addById(id, -Number(qty));
  }
  has(id, qty = 1) {
    const key = String(id);
    const need = Number(qty);
    const have = this.#counts.get(key) || 0;
    return have >= (Number.isFinite(need) ? need : 1);
  }
  getCount(id) {
    return this.#counts.get(String(id)) || 0;
  }
  getCountsSnapshot() {
    const out = {};
    for (const [k, v] of this.#counts.entries()) {
      if (v > 0) out[k] = v;
    }
    return out;
  }
  applyCountsSnapshot(arrOrObj) {
    // Accept [{ id, qty }] or { id: qty }
    this.resetCounts();
    if (Array.isArray(arrOrObj)) {
      arrOrObj.forEach(e => {
        if (e && e.id) this.addById(e.id, e.qty || 1);
      });
    } else if (arrOrObj && typeof arrOrObj === "object") {
      for (const [id, qty] of Object.entries(arrOrObj)) {
        this.addById(id, qty);
      }
    }
  }
  resetCounts() {
    this.#counts.clear();
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
  hasItemInstance(item) {
        return this.#items.includes(item);
    }
    getAll() {
        return [...this.#items];
    }
    resetInventory() {
        this.#items = [];
    }
  getSnapshot() {
    return {
      counts: this.getCountsSnapshot(),
      items: this.getAll().map(i => ({
        name: i.name,
        description: i.description,
        type: (i.constructor && i.constructor.name) || "Item"
      }))
    };
  }
};

module.exports = { Item, TraitItem, Inventory };