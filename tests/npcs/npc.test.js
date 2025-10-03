// src/npcs/npc.test.js
const { Npc, Character, Behavior, CommunicationStep, CommunicationComposite } = require('../../src/npcs/npc');

class DummyView {
    constructor() { this.messages = []; }
    async showMessage(msg) { this.messages.push(msg); }
    async promptChoice(q, arr) { return arr[0]; }
}

describe('Character', () => {
    it('should store and return name, description, avatar', () => {
        const c = new Character('Test', 'desc', 'avatar.png');
        expect(c.name).toBe('Test');
        expect(c.description).toBe('desc');
        expect(c.avatar).toBe('avatar.png');
    });
});

describe('CommunicationStep', () => {
    it('should apply effect to context', () => {
        const effect = ctx => { ctx.tested = true; };
        const step = new CommunicationStep({ message: 'msg', effect });
        const context = {};
        step.applyEffect(context);
        expect(context.tested).toBe(true);
    });
});

describe('Behavior & Npc', () => {
    it('should traverse steps and apply effects', async () => {
        const effect = ctx => { ctx.value = 1; };
        const step1 = new CommunicationStep({ message: 'Hello', effect });
        const step2 = new CommunicationStep({ message: 'Bye' });
        const behavior = new Behavior([step1, step2]);
        const char = new Character('Tester', 'desc', 'avatar');
        const npc = new Npc(char, behavior);
        const context = {};
        const view = new DummyView();
        await npc.interact(context, view);
        expect(context.value).toBe(1);
        expect(view.messages).toContain('Tester: Hello');
    });

    it('should handle choices', async () => {
        const step = new CommunicationStep({
            message: 'Choose',
            choices: { a: 1, b: 2 }
        });
        const step2 = new CommunicationStep({ message: 'End' });
        const behavior = new Behavior([step, step2]);
        const npc = new Npc(new Character('C', '', ''), behavior);
        const view = new DummyView();
        const context = {};
        await npc.interact(context, view);
        expect(view.messages).toContain('C: End');
    });
    it('should follow player choice and apply correct effect', async () => {
        // Step 0: present choices "a" and "b"
        // If "a" chosen, go to step 1; if "b", go to step 2
        const effectA = ctx => { ctx.chosen = 'a'; };
        const effectB = ctx => { ctx.chosen = 'b'; };
        const step0 = new CommunicationStep({
            message: 'Choose your path',
            choices: { a: 1, b: 2 }
        });
        const step1 = new CommunicationStep({ message: 'Path A', effect: effectA });
        const step2 = new CommunicationStep({ message: 'Path B', effect: effectB });
        const behavior = new Behavior([step0, step1, step2]);
        const npc = new Npc(new Character('Decider', '', ''), behavior);

        // DummyView returns "b" for promptChoice
        class ChoiceView extends DummyView {
            async promptChoice(q, arr) { return 'b'; }
        }
        const view = new ChoiceView();
        const context = {};
        await npc.interact(context, view);

        expect(context.chosen).toBe('b');
        expect(view.messages).toContain('Decider: Path B');
    });
});