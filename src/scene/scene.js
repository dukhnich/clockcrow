import fs from "node:fs";

export class Scene {
    render(task) {
        let scene = "";
        for (const descr of task.description) {
            scene += descr + "\n";
        }
        scene += "\n";
        for (const opt of task.options) {
            scene += opt + "\n";
        }
        return scene;
    }
};

// Flyweight for Scene rendering. It has intrinsic state - background image and extrinsic state - task to render.
export class SceneFlyweight extends Scene {
    #background;
    constructor(file) {
        super();
        this.#background = [];
        try {
            const data = fs.readFileSync(file, 'utf8');
            this.#background = data.split(/\r?\n/);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(err);
            }
        }
    }

    render(task) {
        let scene = "";
        const MARGIN = 2;
        if (this.#background.length < task.description.length + task.options.length + MARGIN + 1) {
            return scene;
        }
        let bgIt = this.#background[Symbol.iterator]();
        let magin = "";
        for (let i = 0; i < MARGIN; ++i) {
            scene += bgIt.next().value + "\n";
            magin += " ";
        }
        for (const descr of task.description) {
            scene += bgIt.next().value + magin + descr + "\n";
        }
        scene += bgIt.next().value + "\n";
        for (const opt of task.options) {
            scene += bgIt.next().value + magin + opt + "\n";
        }
        for (const line of bgIt) {
            scene += line + "\n";
        }
        return scene;
    }
};

// Flyweight "factory" that stores flyweights
export class SceneFlyweightFactory {
    #flyweights;
    constructor(flyweights) {
        this.#flyweights = flyweights;
    }

    get(key) {
        let file = this.#flyweights[key];
        return file != null? new SceneFlyweight(file) : new Scene();
    }
};


export class Location {
    #name
    #nps
    #events
    constructor(name) {
        this.#name = name;
    }
    enter() {

    }
    getOptions() {

    }
}

export default { Scene, SceneFlyweight, SceneFlyweightFactory, Location };