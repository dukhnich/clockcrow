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
  let originalLog;
  let originalClear;

  beforeEach(() => {
    cliView = new CLIInquirerView();
    originalLog = console.log;
    originalClear = console.clear;
    console.log = jest.fn();
    console.clear = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.clear = originalClear;
  });

  test('showMessage logs to console', () => {
    cliView.showMessage('Hello');
    expect(console.log).toHaveBeenCalledWith('Hello');
  });

  test('showStatus logs status', () => {
    cliView.showStatus({ health: 10, gold: 5 });
    expect(console.log).toHaveBeenCalledWith('Status:');
    expect(console.log).toHaveBeenCalledWith('  health: 10');
    expect(console.log).toHaveBeenCalledWith('  gold: 5');
  });

  test('showScene renders DTO and asks for choice (list mode)', async () => {
    // Arrange a scene DTO; set background to empty array to avoid FS
    const scene = {
      location: { id: 'market', name: 'Market', background: [] },
      description: ['Welcome to the market.'],
      options: [{ id: 'buy', text: 'Buy' }, { id: 'leave', text: 'Leave' }]
    };
    // Stub promptChoice to avoid real prompting
    const promptSpy = jest.spyOn(cliView, 'promptChoice').mockResolvedValue('buy');

    // Act
    const picked = await cliView.showScene(scene);

    // Assert key outputs and prompt call
    expect(console.log).toHaveBeenCalledWith('Market');
    expect(console.log).toHaveBeenCalledWith('Welcome to the market.');
    expect(promptSpy).toHaveBeenCalledWith('', scene.options, { inline: false });
    expect(picked).toBe('buy');
  });

  test('showScene returns null when no options', async () => {
    const scene = {
      location: { id: 'market', name: 'Market', background: [] },
      description: 'Nothing to choose here.',
      options: []
    };
    const res = await cliView.showScene(scene);
    expect(res).toBeNull();
    expect(console.log).toHaveBeenCalledWith('Market');
    expect(console.log).toHaveBeenCalledWith('Nothing to choose here.');
  });

  test('showDialog logs dialog', () => {
    cliView.showDialog('Hello!');
    expect(console.log).toHaveBeenCalledWith('Dialog: Hello!');
  });

  test('clear calls console.clear', () => {
    cliView.clear();
    expect(console.clear).toHaveBeenCalled();
  });

  test('promptText returns user input', async () => {
    cliView.inquirer = { prompt: jest.fn().mockResolvedValue({ response: 'test' }) };
    const result = await cliView.promptText('Enter:');
    expect(result).toBe('test');
    expect(cliView.inquirer.prompt).toHaveBeenCalled();
  });

  test('promptChoice returns user choice (list mode)', async () => {
    cliView.inquirer = { prompt: jest.fn().mockResolvedValue({ response: 'choice' }) };
    const result = await cliView.promptChoice('Choose:', ['a', 'b'], { inline: false });
    expect(result).toBe('choice');
    expect(cliView.inquirer.prompt).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'list', name: 'response', message: 'Choose:' })
    ]);
  });

  test('promptChoice returns value by index (inline mode default)', async () => {
    // Inline prints numbered options and asks for index
    cliView.inquirer = { prompt: jest.fn().mockResolvedValue({ index: 1 }) }; // selects second item
    const result = await cliView.promptChoice('Choose:', ['A', 'B']);
    expect(result).toBe('B');
    // Ensure options were printed
    expect(console.log).toHaveBeenCalledWith('1) A');
    expect(console.log).toHaveBeenCalledWith('2) B');
  });
});