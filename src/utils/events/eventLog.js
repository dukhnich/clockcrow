class EventLog {
  #tokens = new Set();

  add(token) {
    const t = String(token || "").trim();
    if (t) this.#tokens.add(t);
  }
  has(token) {
    return this.#tokens.has(String(token));
  }
  toArray() {
    return Array.from(this.#tokens);
  }
  clear() {
    this.#tokens.clear();
  }
  load(arr) {
    this.clear();
    if (Array.isArray(arr)) {
      for (const t of arr) this.add(t);
    }
  }
}

module.exports = { EventLog };