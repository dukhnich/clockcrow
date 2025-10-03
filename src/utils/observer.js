class Observer {
    #listeners;
    constructor() {
        this.#listeners = new Set();
    }
    get listeners() { return this.#listeners; }
    subscribe(listener) {
        this.#listeners.add(listener);
    }
    unsubscribe(listener) {
        this.#listeners.delete(listener);
    }
    notify(data) {
        for (let listener of this.#listeners) {
            try {
                listener(data);
            } catch (e) {
                // Optionally log or handle error
            }
        }
    }
    clear() {
        this.#listeners.clear();
    }
}
module.exports = { Observer };