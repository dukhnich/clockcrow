const path = require('node:path');
const { GameFacade } = require('./src/core/gameFacade.js');

async function main() {
  const facade = new GameFacade({
    // Optional overrides:
    // saveFile: path.join(process.cwd(), 'saves', 'slot1.json'),
    // start: { locationId: 'start' },
    // scene: { /* custom stores for tests */ }
  });

  await facade.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});