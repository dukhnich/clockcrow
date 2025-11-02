const { Observer } = require("../utils/observer.js");
const AUTO_TAG = Symbol('auto');

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

class SpeedItem extends Item {
  #speed
  constructor(name, description, effect, speed) {
      super(name, description, effect);
      this.#speed = speed;
  }
  get speed() {return this.#speed};
};

class Inventory {
  #items;
  #observer;
  #counts;
  #itemStore;
  #autoItems;
  constructor(items = []) {
    this.#items = items;
    this.#observer = new Observer();
    this.#counts = new Map();
    this.#autoItems = new Set();
  }

  attachItemStore(itemStore) {
    this.#itemStore = itemStore || null;
    this.#regenerateAutoItemsFromCounts();
  }

  #regenerateAutoItemsFromCounts() {
    if (!this.#itemStore) return;

    // 1) Remove previously auto-generated items (with proper events)
    if (this.#autoItems.size) {
      // copy to array to avoid mutation during iteration
      [...this.#autoItems].forEach((it) => this.remove(it));
      this.#autoItems.clear();
    }

    // 2) Add items per current counts
    const counts = this.getCountsSnapshot();
    Object.entries(counts).forEach(([id, qty]) => {
      const dto = this.#itemStore.getDTO?.(id);
      if (!dto || !dto.type) return;

      // Only materialize special items
      if (dto.type === 'trait') {
        const traitsValues = Array.isArray(dto.traits) ? dto.traits : [];
        for (let i = 0; i < qty; i++) {
          const it = new TraitItem(
            dto.name || id,
            dto.description || '',
            { type: 'trait' },
            traitsValues
          );
          it[AUTO_TAG] = true;
          this.add(it);               // will emit traitItemAdded + itemAdded
          this.#autoItems.add(it);
        }
      } else if (dto.type === 'speed') {
        for (let i = 0; i < qty; i++) {
          const it = new SpeedItem(
            dto.name || id,
            dto.description,
            dto.effect,
            dto.speed
            );
          it[AUTO_TAG] = true;
          this.add(it);               // will emit itemAdded
          this.#autoItems.add(it);
        }
      }
      // other types can be added here later
    });
  }
  addById(id, qty = 1) {
    const n = Number(qty);
    const delta = Number.isFinite(n) ? n : 1;
    if (!this.#counts) this.#counts = new Map();
    const cur = this.#counts.get(id) || 0;
    this.#counts.set(id, Math.max(0, cur + delta));
    this.notify({ type: 'countChanged', id, qty: this.#counts.get(id) });
    this.#regenerateAutoItemsFromCounts();
  }
  removeById(id, qty = 1) {
    const n = Number(qty);
    const delta = Number.isFinite(n) ? n : 1;
    if (!this.#counts) return;
    const cur = this.#counts.get(id) || 0;
    const next = Math.max(0, cur - delta);
    this.#counts.set(id, next);
    if (next === 0) this.#counts.delete(id);
    this.notify({ type: 'countChanged', id, qty: next });
    this.#regenerateAutoItemsFromCounts();
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
    const obj = {};
    if (this.#counts) {
      for (const [id, qty] of this.#counts.entries()) obj[id] = qty;
    }
    return obj;
  }
  applyCountsSnapshot(arrOrObj) {
    // Reset counts
    this.resetCounts();
    if (Array.isArray(arrOrObj)) {
      arrOrObj.forEach(e => {
        if (e && e.id) this.addById(e.id, Number.isFinite(Number(e.qty)) ? Number(e.qty) : 1);
      });
    } else if (arrOrObj && typeof arrOrObj === "object") {
      Object.entries(arrOrObj).forEach(([id, qty]) => this.addById(id, Number(qty)));
    }
  }
  resetCounts() {
    if (this.#counts) this.#counts.clear();
    if (this.#autoItems.size) {
      [...this.#autoItems].forEach((it) => this.remove(it));
      this.#autoItems.clear();
    }
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
    console.log('add', item)
    if (!(item instanceof Item)) throw new TypeError("Only Item instances allowed");
    this.#items.push(item);
    if (item instanceof TraitItem) {
      this.notify({ type: "traitItemAdded", item });
    }
    if (item instanceof SpeedItem) {
      this.notify({ type: "speedItemAdded", item });
    }
    this.notify({ type: "itemAdded", item });
  }

  remove(item) {
    const idx = this.#items.indexOf(item);
    if (idx === -1) return false;
    this.#items.splice(idx, 1);
    if (item instanceof TraitItem) {
      this.notify({ type: "traitItemRemoved", item });
    }
    if (item instanceof SpeedItem) {
      this.notify({ type: "speedItemRemoved", item });
    }
    this.notify({ type: "itemRemoved", item });
    if (item[AUTO_TAG]) this.#autoItems.delete(item);
    return true;
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