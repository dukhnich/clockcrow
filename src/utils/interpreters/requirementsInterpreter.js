const { Expression, Interpreter } = require("./baseInterpreter.js");

class NotExpr extends Expression {
  constructor(inner) {
    super();
    this.inner = inner;
  }
  interpret(svc, env) {
    return !this.inner.interpret(svc, env);
  }
}

class AllExpr extends Expression {
  constructor(items = []) {
    super();
    this.items = items;
  }
  interpret(svc, env) {
    return this.items.every((e) => e.interpret(svc, env));
  }
}
class PredExpr extends Expression {
  constructor(fn) {
    super();
    this.fn = typeof fn === "function" ? fn : () => true;
  }
  interpret(svc, env) {
    return Boolean(this.fn(svc, env));
  }
}

class RequirementInterpreter extends Interpreter {
  #handlers;
  constructor({ timeManager = null, eventLog = null, traits = null, inventory = null, locationStore = null } = {}) {
    super();
    this.time = timeManager;
    this.log = eventLog;
    this.traits = traits;
    this.inventory = inventory;
    this.locationStore = locationStore;
    this.#handlers = new Map();

    // Register default handlers
    this.register("scene", this.#sceneHandler("sceneId"));
    this.register("currentScene", this.#sceneHandler("sceneId"));
    this.register("npc", this.#sceneHandler("currentNpcId"));
    this.register("currentNpc", this.#sceneHandler("currentNpcId"));

    this.register(
      "effect",
      (rest) => new PredExpr((svc) => !!svc.log?.has?.(rest))
    );

    this.register(
      "time:window",
      (rest) => new PredExpr((svc) => {
        const w = svc.time?.getTimeWindow?.();
        return String(w) === String(rest);
      })
    );
    this.register("time:between", (rest) => {
      const [from, to] = String(rest).split(":").map(Number);
      return new PredExpr((svc) => {
        const t = Number(svc.time?.currentTime);
        return Number.isFinite(from) && Number.isFinite(to) && Number.isFinite(t) && t >= from && t <= to;
      });
    });

    this.register("trait", (rest) => {
      const parts = String(rest).split(":");
      const name = parts[0];
      const tv = (svc) => {
        const t = svc.traits?.getTraitByName?.(name);
        const v = Number(t?.value);
        return Number.isFinite(v) ? v : 0;
      };
      const compare = (a, op, b) => {
        switch (op) {
          case ">": return a > b;
          case ">=": return a >= b;
          case "<": return a < b;
          case "<=": return a <= b;
          case "==": return a === b;
          case "!=": return a !== b;
          default: return a >= b;
        }
      };
      if (parts.length === 1)
        return new PredExpr((svc) => tv(svc) > 0);
      if (parts.length === 2 && /^[-+]?\d+(\.\d+)?$/.test(parts[1])) {
        const num = Number(parts[1]);
        return new PredExpr((svc) => tv(svc) >= num);
      }
      if (parts.length >= 2) {
        const m = parts[1].match(/^([<>!=]=?|==)$/);
        const op = m ? m[1] : ">=";
        const num = Number(parts[2]);
        return new PredExpr((svc) => compare(tv(svc), op, num));
      }
      return new PredExpr(() => true);
    });

    // this.register("has:location", (rest) => new PredExpr((_svc, env) => {
    //   const path = Array.isArray(env?.path) ? env.path : [];
    //   return path.includes(String(rest));
    // }));
    //
    // this.register("has:player:money", (rest) => {
    //   const need = Math.max(1, Number(rest) || 0);
    //   return new PredExpr((svc) => {
    //     const inv = svc.inventory;
    //     const tryNum = (v) => Number(v) || 0;
    //     if (!inv) return false;
    //     if (typeof inv.getCount === "function") return tryNum(inv.getCount("money")) >= need;
    //     if (typeof inv.count === "function") return tryNum(inv.count("money")) >= need;
    //     if (typeof inv.getQuantity === "function") return tryNum(inv.getQuantity("money")) >= need;
    //     if (typeof inv.quantity === "function") return tryNum(inv.quantity("money")) >= need;
    //     if (typeof inv.hasItem === "function") return inv.hasItem("money", need);
    //     if (typeof inv.has === "function") return inv.has("money", need);
    //     return false;
    //   });
    // });
  }

  get handlers() { return this.#handlers; }

  register(prefix, builder) {
    if (prefix && typeof builder === "function") {
      this.#handlers.set(String(prefix), builder)
    }
  }

  passes(reqs, env = {}) {
    const list = Array.isArray(reqs) ? reqs : [];
    const exprs = list.map((r) => this.#parseToken(r)).filter(Boolean);
    return new AllExpr(exprs).interpret(this, env);
  }

  #parseToken(token) {
    if (typeof token !== "string" || !token.length) return null;

    if (token.startsWith("not:")) {
      const inner = this.#parseToken(token.slice(4));
      return inner ? new NotExpr(inner) : null;
    }

    // Find longest matching prefix in registry
    let hit = null;
    for (const key of this.handlers.keys()) {
      const pref = key + ":";
      if (token.startsWith(pref)) {
        if (!hit || key.length > hit.key.length) {
          hit = {key, rest: token.slice(pref.length)}
        }
      }
    }
    if (!hit) return new PredExpr(() => true); // unknown tokens don't block

    const builder = this.handlers.get(hit.key);
    try {
      const expr = builder(hit.rest);
      return expr instanceof Expression ? expr : new PredExpr(() => !!expr);
    } catch {
      return new PredExpr(() => true);
    }
  }

  #sceneHandler(field) {
    return (rest) => {
      const handler = (_svc, env) => String(env?.[field] ?? "") === String(rest);
      return new PredExpr(handler());
    };
  }
}

module.exports = { RequirementInterpreter };