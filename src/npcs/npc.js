class Character {
    #name;
    #description;
    #avatar
    constructor(name, description, avatar) {
        this.#name = name;
        this.#description = description;
        this.#avatar = avatar;
    }
    get name() { return this.#name; }
    get description() { return this.#description; }
    get avatar() { return this.#avatar; }
}

class CommunicationStep {
    #message;
    #choices;
    #effect;
    constructor({ message, choices = null, effect = null }) {
        this.#message = message; // Text shown to player
        this.#choices = choices; // { choice: nextStepIndex }
        this.#effect = effect;   // Function to apply effects (traits, inventory, etc.)
    }
    get message() { return this.#message; }
    get choices() { return this.#choices; }
    get effect() { return this.#effect; }

    applyEffect(context) {
        if (typeof this.effect === 'function') {
            this.effect(context);
        }
    }
}

class CommunicationComposite {
    constructor(steps = []) {
        this.steps = steps; // Array of CommunicationStep or CommunicationComposite
    }

    addStep(step) {
        if (step instanceof CommunicationStep || step instanceof CommunicationComposite) {
            this.steps.push(step);
        } else {
            throw new TypeError("Only CommunicationStep or CommunicationComposite instances allowed");
        }
    }

    getStep(index) {
        return this.steps[index];
    }
}

class Behavior {
    #communicationTree;
    constructor(communicationTree = []) {
        if (!Array.isArray(communicationTree) && !(communicationTree instanceof CommunicationComposite)) {
            throw new TypeError("communicationTree must be an array or CommunicationComposite");
        }
        this.#communicationTree = communicationTree;
    }
    get communicationTree() { return this.#communicationTree; }

    async #traverseStep(step, context, npc, view) {
        if (step instanceof CommunicationStep) {
            await view.showMessage(`${npc.character.name}: ${step.message}`);
            step.applyEffect(context);
            if (step.choices) {
                const choiceKeys = Object.keys(step.choices);
                const choice = await view.promptChoice("Choose:", choiceKeys);
                return step.choices[choice];
            }
            return null;
        } else if (step instanceof CommunicationComposite) {
            for (let i = 0; i < step.steps.length; i++) {
                const next = await this.#traverseStep(step.steps[i], context, npc, view);
                if (next !== null) return next;
            }
        }
        return null;
    }


    async act(npc, context = {}, view) {
        if (!(npc instanceof Npc)) throw new TypeError("Only Npc instances allowed");
        let currentStepIndex = context.currentStep || 0;
        const steps = Array.isArray(this.#communicationTree) ? this.#communicationTree : this.#communicationTree.steps;

        while (currentStepIndex < steps.length) {
            const step = steps[currentStepIndex];
            const nextStepIndex = await this.#traverseStep(step, context, npc, view);
            if (nextStepIndex !== null) {
                currentStepIndex = nextStepIndex;
            } else {
                currentStepIndex++;
            }
        }
        return context;
    }
}

class Npc {
    #character;
    #behavior;
    constructor(character, behavior = new Behavior()) {
        if (!(character instanceof Character)) throw new TypeError("Only Character instances allowed");
        if (!(behavior instanceof Behavior)) throw new TypeError("Only Behavior instances allowed");
        this.#character = character;
        this.#behavior = behavior;
    }
    get character() { return this.#character; }
    get behavior() { return this.#behavior; }
    async interact(context = {}, view) {
        return await this.#behavior.act(this, context, view);
    }
}

module.exports = { Npc, Character, Behavior, CommunicationStep, CommunicationComposite };