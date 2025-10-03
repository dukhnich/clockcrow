const inquirer = require("inquirer");
class IGameView {
    constructor() {
        if (new.target === IGameView) {
            throw new Error("Abstract classes can't be instantiated.");
        }
    }
    showMessage(message) {
        throw new Error("Method 'showMessage()' must be implemented.");
    }
    async promptText(question) {
        throw new Error("Method 'promptText()' must be implemented.");
    }
    async promptChoice(question, choicesArray) {
        throw new Error("Method 'promptChoice()' must be implemented.");
    }
    showStatus(statusObj) {
        throw new Error("Method 'showStatus()' must be implemented.");
    }
    showScene(scene) {
        throw new Error("Method 'showScene()' must be implemented.");
    }
    showDialog(dialog) {
        throw new Error("Method 'showDialog()' must be implemented.");
    }
    clear() {
        throw new Error("Method 'clear()' must be implemented.");
    }
}

class CLIInquirerView extends IGameView {
    #inquirer;
    constructor() {
        super();
        this.#inquirer = inquirer;
    }
    set inquirer(inquirerInstance) {
        this.#inquirer = inquirerInstance;
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
module.exports = { IGameView, CLIInquirerView };