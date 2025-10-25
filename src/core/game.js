const { Hint } = require("./hint.js");
const { InitialState } = require("./state.js");
const { Inventory } = require("../inventory/inventory.js");
const { TimeManager } = require("./timeManager.js");
const { TraitsManager } = require("./traitsManager.js");
const { CLIInquirerView } = require("../view/view.js");
const { Cache } = require("./cache.js");
const { Location } = require("../scene/scene.js");

class Game {
    #cache;
    #score;
    #state;
    #view;
    #traitsManager;
    #timeManager;
    #inventory;
    #currentLoc;
    constructor(
        cache,
        score,
        state,         // GameState instance (can be IntroState, etc.)
        view,          // IGameView implementation (CLI, Web, etc.)
        traitsManager,  // TraitManager instance
        timeManager,   // TimeManager instance
        inventory,     // Inventory instance
        currentLoc    // Current Location instance
    ) {
        this.#cache = cache || new Cache("1");
        this.#score = score || 0;
        this.#state = state || new InitialState();
        this.#view = view || new CLIInquirerView();
        this.#traitsManager = traitsManager || new TraitsManager();
        this.#timeManager = timeManager || new TimeManager();
        this.#inventory = inventory || new Inventory();
        this.#currentLoc = currentLoc || new Location("Nowhere", [], ["You are nowhere."] );
        this.#addListeners();
    }
    #addListeners() {
        this.#addTraitsItemListeners();
    }
    #addTraitsItemListeners() {
        this.#inventory.subscribe((event) => {
            if (event.type === "traitItemAdded") {
                event.item.traitsValues.forEach(({ traitName, value }) => {
                    this.#traitsManager.incrementTrait(traitName, value);
                });
            }
            if (event.type === "traitItemRemoved") {
                event.item.traitsValues.forEach(({ traitName, value }) => {
                    this.#traitsManager.decrementTrait(traitName, value);
                });
            }
        });
    }
    get task() { return this.#cache.currentTask; }
    getHint() {
        let hint = this.#cache.currentHint;
        if (this.#score < hint.cost) {
            return Hint.none;
        }
        this.#score -= hint.cost;
        return hint;
    }
    start() {
        this.#state.onEnter(this);
    }
    changeState(newState) {
        if (this.#state) {
            this.#state.onExit(this);
        }
        this.#state = newState;
        if (this.#state) {
            this.#state.onEnter(this);
        }
    }
    get state() { return this.#state; }
    get view() { return this.#view; }
    get traitsManager() { return this.#traitsManager; }
    get timeManager() { return this.#timeManager; }
    get inventory() { return this.#inventory; }
    next(choice) {
        if (choice == 0 || choice > this.task.options.length ||
            !this.#cache.update(this.#cache.key + choice)) {
            return false;
        }
        this.#score += this.task.score;
        return true;
    }

    get history() { return this.#cache.key; }
    get level() { return this.history.length; }
    get score() { return this.#score; }
};

module.exports = { Game };
