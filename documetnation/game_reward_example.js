const fs = require("fs");

// Added Locator for better DI management
class ServiceLocator {
    static #services = new Map();

    static register(name, instance) {
        ServiceLocator.#services.set(name, instance);
    }

    static get(name) {
        if (!ServiceLocator.#services.has(name)) {
            throw new Error(`Service '${name}' not registered`);
        }
        return ServiceLocator.#services.get(name);
    }

    static unregister(name) {
        ServiceLocator.#services.delete(name);
    }
}

class Downloader {
    static download(url) {
        console.log(`Downloading from ${url}`);
        return `Data from ${url}`;
    }
}
class DownloaderFromFile extends Downloader {
    static download(path) {
        const data = fs.readFileSync(path, 'utf-8');
        return JSON.parse(data);
    }
}
class SettingsService {
    #settings
    constructor() {
        this.#settings = {};
    }
    get settings() {
        return this.#settings;
    }
}
class DownloadingSettingsService extends SettingsService {
    #url;
    #downloader;
    #settings
    constructor(url, downloader) {
        super();
        this.#url = url;
        // Dependensy Invertion
        if (!(downloader.prototype instanceof Downloader)) {
            throw new Error("downloader must be Downloader or its subclass");
        }
        this.#downloader = downloader;
        this.#settings = downloader.download(this.#url);
    }
    get settings() {
        return this.#settings;
    }
}

// Dependency Injection with different settings origins
class Settings {
    #service = null;
    constructor(service) {
        this.#service = service;
    }
    get #settings() {
        return this.#service.settings;
    }
    get(key) {
        return this.#settings?.[key];
    }
}

class BasicSettings {
    #settings;
    constructor(settings) {
        this.#settings = settings;
    }
    option1() { return this.#settings.get("option1"); }
}

class AdvancedSettings {
    #settings;
    constructor(settings) {
        this.#settings = settings;
    }
    option2() { return this.#settings.get("option2"); }
    option3() { return this.#settings.get("option3"); }
    option4() { return this.#settings.get("option4"); }
    option5() { return this.#settings.get("option5"); }
}
class Tracker {
    #count;
    constructor() {
        this.#count = {};
    }
    track(key) {
        if (!this.#count[key]) {
            this.#count[key] = 0;
        }
        this.#count[key]++;
    }
    count() {
        return this.#count;
    }
    toString() {
        let result = "Statistics:\n";
        for (let key in this.#count) {
            result += `${key}: ${this.#count[key]}\n`;
        }
        return result;
    }
};

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

class Backpack {
    #items;
    constructor(items) {
        this.#items = items;
    }
    get(index) { return this.#items[index]; }
    set(index, item) { this.#items[index] = item; }
};

// Extract List logic to separate class
class Reward extends Item {
    #score;
    constructor(name, description, score) {
        super(name, description);
        this.#score = score;
    }
    get score() { return this.#score; }
    static none() {
        return new Reward("no reward", "", 0);
    }
};

// DI
class RewardVariants {
    #rewards;
    constructor(rewards = []) {
        this.#rewards = rewards;
    }
    addRewards(rewards) {
        this.#rewards.push(...rewards);
    }
    get rewards() { return this.#rewards; }
}

class RewardsController {
    #rewardVariants;
    #tracker
    constructor(rewardVariants, tracker) {
        this.#rewardVariants = rewardVariants;
        this.#tracker = tracker;
    }
    addRewards(rewards) {
        this.#rewardVariants.addRewards(rewards);
    }
    generate() {
        const size = this.#rewardVariants.rewards.length;
        const ix = Math.floor(Math.random() * (size + 1));
        const got = ix < size ? this.#rewardVariants.rewards[ix] : Reward.none();
        this.#tracker.track(got.name);
        return got;
    }
}

class GameController {
    #tracker;
    #settingsService;
    #settings;
    #baseicSettings;
    #advancedSettings;
    #rewardController;
    constructor(tracker, settingsService, rewardVariants) {
        if (!tracker || !settingsService || !rewardVariants) {
            throw new Error("All dependencies must be provided");
        }
        this.#tracker = tracker;
        this.#settingsService = settingsService;
        this.#settings = new Settings(this.#settingsService);
        this.#baseicSettings = new BasicSettings(this.#settings);
        this.#advancedSettings = new AdvancedSettings(this.#settings);
        this.#rewardController = new RewardsController(rewardVariants, tracker);
    }
    next(choise) {
        this.#tracker.track(choise);
        if (!this.#baseicSettings.option1()) {
            return Reward.none();
        }
        const reward = this.#rewardController.generate();
        console.log(`${reward.name}: ${reward.description}`);
        return reward;
    }
    get settings() {
        return this.#settings;
    }
    get basicSettings() {
        return this.#baseicSettings;
    }
    get advancedSettings() {
        return this.#advancedSettings;
    }
    addRewards(rewards) {
        this.#rewardController.addRewards(rewards);
    }
    exit() {
        console.log(this.#tracker.toString());
    }
}
ServiceLocator.register('tracker', new Tracker());
ServiceLocator.register('settingsService', new DownloadingSettingsService('lection8/homework/settings.json', DownloaderFromFile));
ServiceLocator.register('gameController', new GameController(ServiceLocator.get('tracker'), ServiceLocator.get('settingsService'), new RewardVariants()));

function gameEmulation() {
    const gameController = ServiceLocator.get('gameController');
    const advancedSettings = gameController.advancedSettings;

    const rewards = [
        new Reward("bad reward", "You've got into a trap", -1),
        new Reward("bronze reward", "...", 5),
        new Reward("silver reward", ".....", 10),
        new Reward("gold reward", ".......", 15),
        new Reward(advancedSettings.option2(), advancedSettings.option3(), advancedSettings.option4())
    ];

    gameController.addRewards(rewards);

    let backpack = new Backpack([ new Item("flashlight", "flashlight with a weak battery"),
        new Item("aid kit", "first aid kit"),
        new Item("rope", "rope 20m"),
        new Item("knife", "pocket knife"),
        new Item("lighter", "gas lighter") ]);

    for (let p = 5, i = 0; i < 10; ++i) {
        const choise = Math.floor(Math.random() * 5);
        let reward = gameController.next(choise);
        if (reward.score >= advancedSettings.option4()) {
            backpack.set(--p, reward);
            if (p === 0) {
                break;
            }
        }
    }
    gameController.exit();
}

module.exports = { SettingsService, DownloadingSettingsService, Settings, ServiceLocator, BasicSettings, DownloaderFromFile, AdvancedSettings, Tracker, Item, Backpack, Reward, RewardsController, RewardVariants, GameController, gameEmulation };