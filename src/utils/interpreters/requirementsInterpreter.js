const { Expression, Interpreter } = require("./baseInterpreter.js");

class TrueExpression extends Expression {
  interpret(ctx) { return true; }
}
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
class HasPlayerExpression extends Expression {
  constructor(id, qty = 1) {
    super();
    this.id = String(id || "");
    const n = Number(qty);
    this.qty = Number.isFinite(n) ? n : 1;
  }
  interpret(ctx) {
    return Boolean(ctx?.inventory?.has?.(this.id, this.qty));
  }
}
class HasLocationExpression extends Expression {
  constructor(itemId) {
    super();
    this.itemId = String(itemId || "");
  }
  interpret(ctx) {
    const loc = ctx?.env?.locationId || null;
    if (!loc || !this.itemId) return false;
    return Boolean(ctx?.world?.hasLocationItem?.(loc, this.itemId));
  }
}
class CurrentNpcExpression extends Expression {
  constructor(id) {
    super();
    this.id = String(id);
  }
  interpret(_, env) {
    return String(env?.currentNpcId ?? "") === this.id;
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

class TimeWindowExpression extends Expression {
  constructor(kind, a, b) {
    super();
    this.kind = kind; // "any" | "day" | "night" | "range"
    this.a = (a != null) ? Number(a) : null;
    this.b = (b != null) ? Number(b) : null;
  }
  interpret(svc) {
    const tm = svc?.time;
    if (!tm) return true; // no time manager -> do not block
    if (this.kind === "any") return true;
    if (this.kind === "day" || this.kind === "night") {
      return String(tm.getTimeWindow?.() || "") === this.kind;
    }
    // numeric range
    const end = 24;
    const norm = (v) => {
      let x = Number(v);
      if (!Number.isFinite(x)) return NaN;
      x = ((x % end) + end) % end;
      return x;
    };
    const now = norm(tm.currentTime);
    const f = norm(this.a);
    const t = norm(this.b != null ? this.b : this.a);

    if (Number.isNaN(now) || Number.isNaN(f) || Number.isNaN(t)) return true;

    if (f === t) return Math.abs(now - f) < 1e-9;     // exact hour
    if (f < t) return now >= f && now < t;            // normal range
    return now >= f || now < t;                       // wrapped range
  }
}

class EventSeenExpression extends Expression {
  constructor(token) {
    super();
    this.token = String(token || "");
  }
  interpret(svc) {
    if (!this.token) return false;
    const log = svc?.eventLog;
    if (!log) return false;
    // Try flexible checks against snapshot
    const arr = Array.isArray(log.toArray?.()) ? log.toArray() : [];
    return arr.some((e) => {
      if (typeof e === "string") return e === this.token;
      if (e && typeof e === "object") return e.token === this.token || e.type === this.token;
      return false;
    });
  }
}

class TraitCompareExpression extends Expression {
  constructor(name, op = ">=", rhs = 0) {
    super();
    this.name = String(name || "");
    this.op = String(op || ">=");
    this.rhs = Number(rhs);
  }
  #getValue(traits) {
    if (!traits || !this.name) return 0;
    if (typeof traits.getValue === "function") return Number(traits.getValue(this.name) || 0);
    if (typeof traits.getTraitValue === "function") return Number(traits.getTraitValue(this.name) || 0);
    const arr = Array.isArray(traits.traits) ? traits.traits : [];
    const t = arr.find(x => x && x.name === this.name);
    return Number(t?.value || 0);
  }
  interpret(svc) {
    const lhs = this.#getValue(svc?.traits);
    switch (this.op) {
      case ">": return lhs > this.rhs;
      case ">=": return lhs >= this.rhs;
      case "<": return lhs < this.rhs;
      case "<=": return lhs <= this.rhs;
      case "=":
      case "==": return lhs === this.rhs;
      case "!=": return lhs !== this.rhs;
      default: return lhs >= this.rhs;
    }
  }
}

class RequirementFactory {
  static from(def) {
    if (def == null) return new TrueExpression();

    if (Array.isArray(def)) {
      return new AllExpr(def.map(d => RequirementFactory.from(d)));
    }

    if (typeof def === "string") {
      const parts = String(def).split(":").map(s => s.trim());
      const head = parts.shift();

      if (head === "not") {
        return new NotExpr(RequirementFactory.from(parts.join(":")));
      }

      if (head === "has") {
        const scope = parts.shift();
        if (scope === "player") {
          const [id, qty] = parts;
          return new HasPlayerExpression(id, qty != null ? Number(qty) : 1);
        }
        if (scope === "location") {
          const [id, qty] = parts;
          return new HasLocationExpression(id, qty != null ? Number(qty) : 1);
        }
        return new TrueExpression();
      }

      if (head === "currentNpc") {
        const id = parts[0];
        return new CurrentNpcExpression(id);
      }

      if (head === "time") {
        if (!parts.length || parts[0] === "any") return new TimeWindowExpression("any");
        if (parts[0] === "day" || parts[0] === "night") return new TimeWindowExpression(parts[0]);
        // numeric: time:<from>[:<to>]
        const from = Number(parts[0]);
        const to = parts[1] != null ? Number(parts[1]) : from;
        return new TimeWindowExpression("range", from, to);
      }

      if (head === "event") {
        const token = parts[0];
        return new EventSeenExpression(token);
      }

      if (head === "trait") {
        const name = parts[0];
        if (parts.length === 1) return new TraitCompareExpression(name, ">=", 1);
        if (parts.length === 2) return new TraitCompareExpression(name, ">=", Number(parts[1]));
        const [op, val] = [parts[1], Number(parts[2])];
        return new TraitCompareExpression(name, op, val);
      }

      // Unknown head -> treat as always true to avoid blocking content
      return new TrueExpression();
    }

    if (typeof def === "object") {
      // Support { all: [...] } or { not: ... } shapes if needed
      if (Array.isArray(def.all)) return new AllExpr(def.all.map(d => RequirementFactory.from(d)));
      if (def.not != null) return new NotExpr(RequirementFactory.from(def.not));
    }

    return new TrueExpression();
  }
}

class RequirementInterpreter extends Interpreter {
  constructor({ timeManager = null, eventLog = null, traits = null, inventory = null, locationStore = null, world = null } = {}) {
    super();
    this.time = timeManager;
    this.eventLog = eventLog;
    this.traits = traits;
    this.inventory = inventory;
    this.locationStore = locationStore;
    this.world = world;
  }

  compile(def) {
    return RequirementFactory.from(def);
  }

  passes(def, env = {}) {
    const expr = this.compile(def);
    // Provide the services expected by terminals
    const svc = {
      time: this.time,
      eventLog: this.eventLog,
      traits: this.traits,
      inventory: this.inventory,
      locationStore: this.locationStore,
      world: this.world,
      env
    };
    return Boolean(expr.interpret(svc, env));
  }
}

class RequirementInterpreter1 extends Interpreter {
  #handlers
  constructor({ timeManager = null, eventLog = null, traits = null, inventory = null, locationStore = null, world = null } = {}) {
    super();
    this.time = timeManager;
    this.log = eventLog;
    this.traits = traits;
    this.inventory = inventory;
    this.locationStore = locationStore;
    this.world = world;
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