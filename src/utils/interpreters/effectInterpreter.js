const { Expression, Interpreter } = require("./baseInterpreter.js");

class GoExpression extends Expression {
  constructor({ locationId = null, sceneId = null }) {
    super();
    this.locationId = locationId ? String(locationId) : null;
    this.sceneId = sceneId ? String(sceneId) : null;
  }

  async interpret(ctx) {
    if (!ctx?.events || !this.locationId) return null;
    const payload = this.sceneId
      ? { locationId: this.locationId, sceneId: this.sceneId }
      : { locationId: this.locationId };
    ctx.events.emit("go", payload);
    return payload;
  }
}

class ChangeTraitExpression extends Expression {
  constructor({ name, delta }) {
    super();
    this.name = name;
    this.delta = Number(delta);
  }

  async interpret(ctx) {
    if (this.name && Number.isFinite(this.delta)) {
      ctx?.traits?.incrementTrait?.(this.name, this.delta);
    }
    return null;
  }
}

class DomainEventExpression extends Expression {
  constructor({ token, args = [] }) {
    super();
    this.token = String(token || "");
    this.args = Array.isArray(args) ? args : [args];
  }

  async interpret(ctx) {
    ctx?.eventLog?.add?.(this.token);

    ctx?.events?.emit?.(`effect:${this.token}`, { token: this.token, args: this.args });
    ctx?.events?.emit?.(this.token, { token: this.token, args: this.args });
    return null;
  }
}

class SequenceExpression extends Expression {
  constructor(children = []) {
    super();
    this.children = Array.isArray(children) ? children : [];
  }

  async interpret(ctx) {
    let last = null;
    for (const child of this.children) {
      // eslint-disable-next-line no-await-in-loop
      const res = await child.interpret(ctx);
      if (res != null) last = res;
    }
    return last;
  }
}

class TimeExpression extends Expression {
  constructor(time) {
    super();
    this.time = Number(time) || 0;
  }

  async interpret(ctx) {
    if (!ctx?.events) return null;
    if (this.time > 0) ctx.events.emit("effect", { time: this.time });
    return this.time;
  }
}

class EffectFactory {
  static from(def) {
    if (def == null) return new SequenceExpression([]);

    if (Array.isArray(def)) {
      const parts = [];
      for (const d of def) {
        const expr = this.from(d);
        if (expr instanceof SequenceExpression) parts.push(...expr.children);
        else if (expr) parts.push(expr);
      }
      return new SequenceExpression(parts);
    }

    if (typeof def === "string") {
      const token = String(def).trim();
      if (token.startsWith("go:")) {
        const [, rest] = token.split("go:");
        const [locationId, sceneId] = String(rest || "").split(":");
        return new GoExpression({ locationId, sceneId });
      }
      if (token.startsWith("time:")) {
        const n = Number(token.slice(5));
        return new TimeExpression(Number.isFinite(n) ? n : 0);
      }
      return new DomainEventExpression({ token });
    }

    if (typeof def === "object") {
      // Nested list of effects
      if (def.effects != null || def.effect != null) {
        const payload = def.effects != null ? def.effects : def.effect;
        return this.from(payload);
      }
      // go in object form
      if (def.go != null) {
        const go = def.go;
        if (typeof go === "string") {
          const [locationId, sceneId] = go.split(":");
          return new GoExpression({ locationId, sceneId });
        }
        if (typeof go === "object") {
          const locationId = go.locationId || go.location || "";
          const sceneId = go.sceneId || undefined;
          return new GoExpression({ locationId, sceneId });
        }
      }
      // { locationId, sceneId } object shorthand
      if (def.locationId || def.location) {
        const locationId = def.locationId || def.location || "";
        const sceneId = def.sceneId || undefined;
        return new GoExpression({ locationId, sceneId });
      }
      // Fallback: treat as a domain event token if present
      if (def.token) {
        return new DomainEventExpression({ token: def.token, args: def.args || [] });
      }
    }

    // Future: object notation
    return new SequenceExpression([]);
  }
  static hasExplicitTime(def) {
    if (def == null) return false;
    if (typeof def === "number") return true;
    if (typeof def === "object") {
      if (Object.prototype.hasOwnProperty.call(def, "time")) return true;
      const list = def.effects || def.sequence || def.traits;
      if (Array.isArray(list)) return list.some(EffectFactory.hasExplicitTime);
    }
    return false;
  }
}

class EffectInterpreter extends Interpreter {
  constructor({ events, traits, time, eventLog } = {}) {
    super();
    this.events = events;
    this.traits = traits;
    this.time = time;
    this.eventLog = eventLog;
  }

  async interpret(def, opts = {}) {
    const parts = [];
    const timeCost = Number(opts?.timeCost);
    if (Number.isFinite(timeCost) && timeCost > 0) {
      parts.push(new TimeExpression(timeCost));
    }

    const body = EffectFactory.from(def);
    if (body instanceof SequenceExpression) parts.push(...body.children);
    else if (body) parts.push(body);

    const seq = new SequenceExpression(parts);
    return await seq.interpret(this);
  }
}


module.exports = { EffectInterpreter };