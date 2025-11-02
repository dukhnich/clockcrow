const fs = require("fs");
const path = require("path");
const inquirerModule = require("inquirer");
const inquirer = inquirerModule && inquirerModule.default ? inquirerModule.default : inquirerModule;
const chalkPipe = require('chalk-pipe')

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
    // choicesArray: string[] | { id?, name?, value?, text? }[], opts?: { inline?: boolean }
    async promptChoice(question, choicesArray, opts = {}) {
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
    showChoiceResult(optionDto) {
      throw new Error("Method 'showChoiceResult()' must be implemented.");
    }
  async showPath(paths, opts = {}) { throw new Error("Method 'showPath()' must be implemented."); }
  showTraitsResult(result) {
    throw new Error("Method 'showTraitsResult()' must be implemented.");
  }
  finishGame() {
    throw new Error("Method 'finishGame()' must be implemented.");
  }
  exit() {
    throw new Error("Method 'exit()' must be implemented.");
  }
  async showInventory(snapshot) { throw new Error("Method 'showInventory()' must be implemented."); }

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
    get inquirer() {
      return this.#inquirer;
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

  /**
   * Prompt a choice.
   * - Inline mode (default): prints numbered options under the scene and asks for a number.
   * - List mode: uses Inquirer list (set { inline: false }).
   * choicesArray: string[] | { id?, name?, value?, text? }[]
   * Returns the selected value: for objects -> id/value; for strings -> the string.
   */
  async promptChoice(question, choicesArray, opts = {}) {
    const inline = opts.inline !== false;

    const items = this.#normalizeChoices(choicesArray);

    if (!inline) {
      const answers = await this.#inquirer.prompt([
        {
          type: 'list',
          name: 'response',
          message: question,
          choices: items.map(i => ({ name: i.label, value: i.value }))
        }
      ]);
      return answers.response;
    }

    if (question) console.log(question);
    this.#printNumberedOptions(items);

    const answers = await this.#inquirer.prompt([
      {
        type: 'input',
        name: 'index',
        message: `Enter a number 1..${items.length}:`,
        validate: (val) => {
          const n = parseInt(String(val).trim(), 10);
          if (Number.isNaN(n)) return 'Please enter a number.';
          if (n < 1 || n > items.length) return `Enter between 1 and ${items.length}.`;
          return true;
        },
        filter: (val) => parseInt(String(val).trim(), 10) - 1
      }
    ]);

    return items[answers.index].value;
  }

  #normalizeChoices(choicesArray) {
    const arr = Array.isArray(choicesArray) ? choicesArray : [];
    return arr.map(c => {
      if (typeof c === 'string') return { label: c, value: c };
      const label = c.text || c.name || c.id || c.value || '';
      const value = c.id ?? c.value ?? label;
      return { label, value };
    });
  }

  #printNumberedOptions(items) {
    for (let i = 0; i < items.length; i++) {
      console.log(`${i + 1}) ${items[i].label}`);
    }
    console.log('');
  }

    showStatus(statusObj) {
        console.log("Status:");
        for (const [key, value] of Object.entries(statusObj)) {
            console.log(`  ${key}: ${value}`);
        }
    }

    showTime({ time, window }) {
      const day = chalkPipe('yellow.bold');
      const night = chalkPipe('blue.bold');
      const text = `⏳ ${time} ${window === 'day' ? '☀️' : '🌙'})`;
      console.log(window === 'day' ? day(text) : night(text));
    }
  async showInventory(snapshot) {
    const title = chalkPipe('cyan.bold');
    const key = chalkPipe('white');
    const val = chalkPipe('white.bold');

    console.log(title("== Майно =="));
    const counts = (snapshot && snapshot.counts) || {};
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];

    const ids = Object.keys(counts);
    if (!ids.length && !items.length) {
      console.log("Ніц нема.");
      console.log("");
      await this.promptText("Продовжити пошуки...");
      return;
    }

    if (ids.length) {
      console.log(key("Stackables:"));
      ids.forEach(id => console.log(`  ${id}: ${val(counts[id])}`));
      console.log("");
    }
    if (items.length) {
      console.log(key("Речі:"));
      items.forEach(it => console.log(`  ${it.name}${it.description ? ` — ${it.description}` : ""}`));
      console.log("");
    }
    await this.promptText("Продовжити пошуки...");
  }

  async showPath(paths, opts = {}) {
    const includeBack = opts.includeBack !== false;
    const list = Array.isArray(paths) ? paths.slice() : [];
    const choices = list.map(p => ({ name: p.name || p.id, value: p.id }));
    if (includeBack) choices.push({ name: 'Back', value: 'back' });
    const picked = await this.promptChoice('Choose destination:', choices, { inline: false });
    return picked;
  }
  async showScene(scene) {
    // data-first DTO
    const dto = scene && typeof scene === "object" ? scene : null;
    if (!dto) { console.log("No scene data."); return; }

    const body = [];

    // Title
    const title = dto.location && (dto.location.name || dto.location.id);
    const titleDecorated = title ? chalkPipe('green.bold')(title.toUpperCase()) : null;
    if (titleDecorated) {
      body.push(titleDecorated);
      body.push("");
    }

    // Description
    if (Array.isArray(dto.description)) {
      for (const d of dto.description) body.push(d);
    } else if (typeof dto.description === 'string' && dto.description) {
      body.push(dto.description);
    }
    body.push('');

    // NPC section
    if (dto.currentNpc && (dto.currentNpc.name || dto.currentNpc.text)) {
      const label = dto.currentNpc.name ? String(dto.currentNpc.name) : 'NPC';
      body.push(`${label.toUpperCase()}`);
      if (Array.isArray(dto.currentNpc.description)) {
        for (const d of dto.currentNpc.description) body.push(d);
      } else if (typeof dto.currentNpc.description === 'string' && dto.description) {
        body.push(dto.currentNpc.description);
      }
      body.push('')
      const npcLines = typeof dto.currentNpc.text === 'string'
        ? dto.currentNpc.text.split(/\r?\n/)
        : (Array.isArray(dto.currentNpc.text) ? dto.currentNpc.text : []);
      npcLines.forEach((l) => body.push(l));
      body.push('');
    }

    // Background
    const bg = this.#loadBackgroundLines(dto.location);
    this.#renderColumns(bg, body, 2, "  ");

    const choices = Array.isArray(dto.options) ? dto.options : [];
    if (!choices.length) return null;

    return await this.promptChoice('', choices, { inline: false });
  }
  async showChoiceResult(optionDto) {
    if (!optionDto || typeof optionDto !== "object") return true;
    console.log(`Ви обрали: ${optionDto.text || ""}`);
    console.log("");
    const message = optionDto.result || null;
    if (!message) return true;
    console.log("Результат:");
    const lines = Array.isArray(message) ? message : String(message).split(/\r?\n/);
    for (const l of lines) console.log(l);
    console.log("");
    return await this.promptText("Далі...");
  }
  #loadBackgroundLines(location) {
    if (!location || typeof location !== "object") return [];
    // array of lines provided
    if (Array.isArray(location.background)) return location.background.slice();

    // explicit path or default per location id
    let bgPath = null;
    if (typeof location.background === "string") {
      // resolve any non-absolute path relative to the location folder
      if (!path.isAbsolute(location.background) && location.id) {
        const baseDir = path.join("scenario", "locations", location.id);
        bgPath = path.resolve(baseDir, location.background);
      } else {
        bgPath = location.background;
      }
    } else if (location.id) {
      bgPath = path.join("scenario", "locations", location.id, "background.txt");
    }
    if (!bgPath) return [];

    try {
      const data = fs.readFileSync(bgPath, "utf8");
      return data.split(/\r?\n/);
    } catch {
      return [];
    }
  }

  #renderColumns(backgroundLines, bodyLines, marginTop = 2, spacer = "  ") {
    const bg = Array.isArray(backgroundLines) ? backgroundLines : [];
    const body = Array.isArray(bodyLines) ? bodyLines : [];

    if (bg.length === 0) { for (const l of body) console.log(l); return; }

    const leftWidth = bg.reduce((w, l) => Math.max(w, (l || "").length), 0);
    const totalRows = Math.max(bg.length, marginTop + body.length);

    for (let row = 0; row < totalRows; row++) {
      const bgLine = (bg[row] !== undefined) ? bg[row].padEnd(leftWidth, " ") : "".padEnd(leftWidth, " ");
      const textIndex = row - marginTop;
      const textLine = (textIndex >= 0 && textIndex < body.length) ? body[textIndex] : "";
      console.log(bgLine + spacer + textLine);
    }
  }
  async showTraitsResult(result) {
    const title = chalkPipe('magenta.bold');
    const key = chalkPipe('cyan');
    const val = chalkPipe('white.bold');

    console.log(title("=== *** ==="));

    if (!result || typeof result !== "object") {
      console.log("No data.");
      console.log("");
      return;
    }

    const topTraits = Array.isArray(result.topTraits) ? result.topTraits : [];

    const meta = (result && result.meta) || {};
    const side = meta.side || null;
    const trait = meta.trait || null;
    const defaults = meta.defaults || {};
    const isTie = topTraits.length > 1;

    const body = [];

    if (isTie && defaults.tie) {
      if (defaults.tie.title) body.push(val(defaults.tie.title));
      const desc = Array.isArray(defaults.tie.description)
        ? defaults.tie.description : (defaults.tie.description ? [defaults.tie.description] : []);
      body.push(...desc);
    } else {

      if (trait) {
        const ch = trait.character || null;
        if (ch) {
          body.push('');
          if (ch.name) body.push(`${key('Фігура:')} ${val(ch.name)}`);
          if (ch.description) body.push(String(ch.description));
        }
        body.push('');

        body.push(`${key('Головна риса:')} ${val(trait.name || trait.id)}`);
        const tdesc = Array.isArray(trait.description)
          ? trait.description : (trait.description ? [trait.description] : []);
        body.push(...tdesc);
        body.push('');
      } else if (defaults.unknownTrait) {
        const udesc = Array.isArray(defaults.unknownTrait.description)
          ? defaults.unknownTrait.description
          : (defaults.unknownTrait.description ? [defaults.unknownTrait.description] : []);
        body.push(...udesc);
      }

      if (side) {
        body.push(`${key('Вам до душі')} ${val(side.name || side.id)}`);
        const sdesc = Array.isArray(side.description)
          ? side.description : (side.description ? [side.description] : []);
        body.push(...sdesc);
        body.push('');
      }

      const epilogue = [];
      if (side && side.epilogue) {
        epilogue.push(...(Array.isArray(side.epilogue) ? side.epilogue : [side.epilogue]));
      }
      if (trait && trait.epilogue) {
        epilogue.push(...(Array.isArray(trait.epilogue) ? trait.epilogue : [trait.epilogue]));
      }
      if (epilogue.length) {
        body.push(key('Витяг з літопису:'));
        body.push(...epilogue);
      }
    }

    // Optional avatar column
    let avatarLines = [];
    const avatarPath = trait && trait.character && trait.character.avatar ? String(trait.character.avatar) : null;
    if (avatarPath) {
      // avatarLines = this.#loadAscii(avatarPath);
    }

    if (avatarLines.length) {
      this.#renderColumns(avatarLines, body, 2, "  ");
    } else {
      for (const l of body) console.log(l);
    }
    console.log('');
  }

  finishGame() {
    const end = chalkPipe('red.bold');
    console.log(end('Game over.'));
    this.exit();
  }
  exit() {
    const end = chalkPipe('red.green');
    console.log(end('EXIT'));
    process.exit(0);
  }

  showDialog(dialog) {
        console.log(`Dialog: ${dialog}`);
    }

    clear() {
      const out = process.stdout;
      // Robust clear: clear screen + scrollback where supported
      if (out && typeof out.write === 'function') {
        out.write('\x1b[2J'); // Clear screen
        out.write('\x1b[3J'); // Clear scrollback
        out.write('\x1b[H');  // Move cursor to home
      } else {
        // Fallback: push content off-screen
        console.log('\n'.repeat(100));
      }
    }
}
module.exports = { IGameView, CLIInquirerView };