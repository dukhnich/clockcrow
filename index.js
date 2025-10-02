

class GameFacade {
    #saver;
    #game;
    #sceneFactory;
    constructor() {
        this.#saver = new FileSaver("lection5/examples/save.txt");
        this.#game = this.#saver.load();
        this.#sceneFactory = new SceneFlyweightFactory({ 'DNGN': "lection11/examples/dungeon.txt" });
    }

    start() {
        return this.#sceneFactory.get('DNGN').render(this.#game.task);
    }

    next(choise) {
        let save = new AutoSaver(this.#saver, this.#game);
        this.#game.next(choise);
        return this.#sceneFactory.get('DNGN').render(this.#game.task);
    }
};

console.log('hello');
