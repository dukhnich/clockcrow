const fs = require("fs");
const path = require("path");
const inquirerModule = require("inquirer");
const inquirer = inquirerModule && inquirerModule.default ? inquirerModule.default : inquirerModule;

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

  // scene: {
  //   location: { id, name, background? /* string path | string[] lines */ },
  //   from?, to?, description: string|string[], options: ({id,name}|string)[], currentNpc?: { id, name, text }
  // }
  async showScene(scene) {
    // data-first DTO
    const dto = scene && typeof scene === "object" ? scene : null;
    if (!dto) { console.log("No scene data."); return; }

    const body = [];

    // Title
    const title = dto.location && (dto.location.name || dto.location.id);
    if (title) {
      body.push(title);
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
    showDialog(dialog) {
        console.log(`Dialog: ${dialog}`);
    }

    clear() {
        console.clear();
    }
}
module.exports = { IGameView, CLIInquirerView };