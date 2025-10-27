const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FileSaver, AutoSaver } = require('../../src/core/saver.js');

describe('FileSaver', () => {
  let tmpDir;
  let saveFile;
  let saver;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-'));
    saveFile = path.join(tmpDir, 'slot1.json');
    saver = new FileSaver(saveFile);
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('load returns null when file missing', () => {
    expect(saver.isFileExists()).toBe(false);
    const data = saver.load();
    expect(data).toBeNull();
  });

  test('save writes JSON and isFileExists reflects presence', () => {
    const game = {
      get currentScene() { return { id: 'start' }; },
      get currentLocationId() { return 'market'; },
      get history() { return [{ locationId: 'market', sceneId: 'start' }]; }
    };

    const ok = saver.save(game);
    expect(ok).toBe(true);
    expect(saver.isFileExists()).toBe(true);

    const raw = fs.readFileSync(saveFile, 'utf8');
    const obj = JSON.parse(raw);
    expect(obj.version).toBe(1);
    expect(obj.pointer).toEqual({ locationId: 'market', sceneId: 'start' });
    expect(Array.isArray(obj.history)).toBe(true);
  });

  test('load returns saved payload', () => {
    const game = {
      get currentScene() { return { id: 'start' }; },
      get currentLocationId() { return 'market'; },
      get history() { return [{ locationId: 'market', sceneId: 'start' }]; }
    };
    saver.save(game);
    const data = saver.load();
    expect(data).toBeTruthy();
    expect(data.pointer).toEqual({ locationId: 'market', sceneId: 'start' });
    expect(data.history.length).toBe(1);
  });
});

describe('AutoSaver', () => {
  let tmpDir;
  let saveFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autosave-'));
    saveFile = path.join(tmpDir, 'slot1.json');
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('after calls saver.save on success', async () => {
    const saver = new FileSaver(saveFile);
    const game = { currentScene: { id: 'x' }, currentLocationId: 'loc', history: [] };
    const spy = jest.spyOn(saver, 'save');

    const autosave = new AutoSaver(saver, game);
    const res = await autosave.after(async () => 'ok');

    expect(res).toBe('ok');
    expect(spy).toHaveBeenCalledWith(game);
  });

  test('after calls saver.save even when fn throws', async () => {
    const saver = new FileSaver(saveFile);
    const game = { currentScene: { id: 'x' }, currentLocationId: 'loc', history: [] };
    const spy = jest.spyOn(saver, 'save');

    const autosave = new AutoSaver(saver, game);
    await expect(autosave.after(() => { throw new Error('boom'); })).rejects.toThrow('boom');

    expect(spy).toHaveBeenCalledWith(game);
  });
});