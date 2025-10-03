const { IGameView, CLIInquirerView } = require('../../src/view/view');

describe('IGameView', () => {
    let view;
    beforeEach(() => {
        view = Object.create(IGameView.prototype);
    });

    test('abstract methods throw errors', async () => {
        expect(() => view.showMessage()).toThrow();
        expect(() => view.showStatus()).toThrow();
        expect(() => view.showScene()).toThrow();
        expect(() => view.showDialog()).toThrow();
        expect(() => view.clear()).toThrow();
        await expect(view.promptText()).rejects.toThrow();
        await expect(view.promptChoice()).rejects.toThrow();
    });
});

describe('CLIInquirerView', () => {
    let cliView;
    beforeEach(() => {
        cliView = new CLIInquirerView();
    });

    test('showMessage logs to console', () => {
        console.log = jest.fn();
        cliView.showMessage('Hello');
        expect(console.log).toHaveBeenCalledWith('Hello');
    });

    test('showStatus logs status', () => {
        console.log = jest.fn();
        cliView.showStatus({ health: 10, gold: 5 });
        expect(console.log).toHaveBeenCalledWith('Status:');
        expect(console.log).toHaveBeenCalledWith('  health: 10');
        expect(console.log).toHaveBeenCalledWith('  gold: 5');
    });

    test('showScene logs scene', () => {
        console.log = jest.fn();
        cliView.showScene('Market');
        expect(console.log).toHaveBeenCalledWith('Scene: Market');
    });

    test('showDialog logs dialog', () => {
        console.log = jest.fn();
        cliView.showDialog('Hello!');
        expect(console.log).toHaveBeenCalledWith('Dialog: Hello!');
    });

    test('clear calls console.clear', () => {
        console.clear = jest.fn();
        cliView.clear();
        expect(console.clear).toHaveBeenCalled();
    });

    test('promptText returns user input', async () => {
        cliView.inquirer = { prompt: jest.fn().mockResolvedValue({ response: 'test' }) };
        const result = await cliView.promptText('Enter:');
        expect(result).toBe('test');
    });

    test('promptChoice returns user choice', async () => {
        cliView.inquirer = { prompt: jest.fn().mockResolvedValue({ response: 'choice' }) };
        const result = await cliView.promptChoice('Choose:', ['a', 'b']);
        expect(result).toBe('choice');
    });
});