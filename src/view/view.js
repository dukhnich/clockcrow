import inquirer from "inquirer";
export class IGameView {
    constructor() {
        if (this.constructor === IGameView) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }
    showMessage(message) {}

    async promptText(question) {}

    async promptChoice(question, choicesArray) {}

    showStatus(statusObj) {}

    showScene(scene) {}
    showDialog(dialog) {}

    clear() {}

}

export class CLIInquirerView extends IGameView {
    constructor() {
        super();
        this.#inquirer = inquirer;
    }
    showMessage(message) {
        console.log(message);
    }

    async promptText(question) {
        const answers = await this.#inquirer.prompt([
            {
                type: 'input',
                name: 'response',
                message: question
            }
        ]);
        return answers['response'];
    }

    async promptChoice(question, choicesArray) {
        const answers = await this.#inquirer.prompt([
            {
                type: 'list',
                name: 'response',
                message: question,
                choices: choicesArray
            }
        ]);
        return answers['response'];
    }

    showStatus(statusObj) {
        console.log("Status:");
        for (const [key, value] of Object.entries(statusObj)) {
            console.log(`  ${key}: ${value}`);
        }
    }

    showScene(scene) {
        console.log(`Scene: ${scene}`);
    }
    showDialog(dialog) {
        console.log(`Dialog: ${dialog}`);
    }

    clear() {
        console.clear();
    }
}
export default { IGameView, CLIInquirerView };