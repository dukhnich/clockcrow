const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SceneCache } = require('../../src/core/cache.js');

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

describe('SceneCache', () => {
  let tmpDir;
  let baseDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-cache-'));
    baseDir = tmpDir;

    // locations/market/info.json
    writeJson(path.join(baseDir, 'market', 'info.json'), {
      name: 'Market',
      startSceneId: 'start',
      scenes: [
        { id: 'start', description: 'Welcome', optionIds: [] },
        { id: 'buy', description: 'Buy smth', optionIds: [] }
      ],
      path: ['ASCII']
    });

    // locations/shop/info.json
    writeJson(path.join(baseDir, 'shop', 'info.json'), {
      name: 'Shop',
      startSceneId: 'enter',
      scenes: [{ id: 'enter' }, { id: 'leave' }]
    });

    // locations/arena/info.json (no startSceneId → fallback to first scene)
    writeJson(path.join(baseDir, 'arena', 'info.json'), {
      name: 'Arena',
      scenes: [{ id: 'a1' }, { id: 'a2' }]
    });
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('initial pointer resolves start scene when sceneId omitted', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    expect(cache.pointer).toEqual({ locationId: 'market', sceneId: 'start' });
    expect(cache.history.length).toBe(1);

    const scene = cache.currentScene();
    expect(scene).toBeTruthy();
    expect(scene.id).toBe('start');
    expect(scene.locationId).toBe('market');
  });

  test('setCurrent with unknown scene id falls back to startSceneId', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    cache.setCurrent('market', 'unknown');
    expect(cache.pointer).toEqual({ locationId: 'market', sceneId: 'start' });
  });

  test('setCurrent without startSceneId falls back to first scene', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    cache.setCurrent('arena', 'unknown');
    expect(cache.pointer).toEqual({ locationId: 'arena', sceneId: 'a1' });
  });

  test('applyResult go:<sceneId> within the same location', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    const beforeLen = cache.history.length;
    cache.applyResult('go:buy');
    expect(cache.pointer).toEqual({ locationId: 'market', sceneId: 'buy' });
    expect(cache.history.length).toBe(beforeLen + 1);
  });

  test('applyResult go:<locationId>:<sceneId>', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    cache.applyResult('go:shop:leave');
    expect(cache.pointer).toEqual({ locationId: 'shop', sceneId: 'leave' });
  });

  test('applyResult go:<locationId> resolves to that location start', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'shop', sceneId: 'leave' } });
    cache.applyResult('go:market');
    expect(cache.pointer).toEqual({ locationId: 'market', sceneId: 'start' });
  });

  test('history getter returns a copy', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    const h1 = cache.history;
    const lenBefore = h1.length;
    h1.push({ locationId: 'x', sceneId: 'y' });
    const h2 = cache.history;
    expect(h2.length).toBe(lenBefore); // internal history not mutated
  });

  test('assembler and stores getters exist', () => {
    const cache = new SceneCache({ baseDir, start: { locationId: 'market' } });
    expect(cache.assembler).toBeTruthy();
    const stores = cache.stores;
    expect(stores).toBeTruthy();
    expect(stores.optionStore).toBeTruthy();
    expect(stores.npcStore).toBeTruthy();
    expect(stores.locationStore).toBeTruthy();
  });
});