class Expression {
  async interpret(ctx) {
    return null;
  }
}

class GoExpression extends Expression {
  constructor({ locationId = null, sceneId = null }) {
    super();
    this.locationId = locationId;
    this.sceneId = sceneId;
  }

  async interpret(ctx) {
    if (this.locationId && this.sceneId) {
      const payload = { locationId: this.locationId, sceneId: this.sceneId };
      ctx?.events?.emit?.("go", payload);
      return payload;
    }
    if (this.sceneId) {
      const payload = { sceneId: this.sceneId };
      ctx?.events?.emit?.("go", payload);
      return payload;
    }
    return null;
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
    this.token = token;
    this.args = Array.isArray(args) ? args : [];
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
    this.children = children;
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

class EffectFactory {
  static from(def) {
    if (def == null) return new SequenceExpression([]);

    if (Array.isArray(def)) {
      return new SequenceExpression(def.map((d) => EffectFactory.from(d)));
    }

    if (typeof def === "string") {
      const [head, ...rest] = String(def).split(":");
      switch (head) {
        case "go": {
          if (rest.length === 1) {
            return new GoExpression({ sceneId: rest[0] });
          }
          if (rest.length >= 2) {
            return new GoExpression({ locationId: rest[0], sceneId: rest[1] });
          }
          return new SequenceExpression([]);
        }
        case "changeTrait": {
          const [name, delta] = rest;
          return new ChangeTraitExpression({ name, delta });
        }
        default:
          return new DomainEventExpression({ token: head, args: rest });
      }
    }

    // Future: object notation
    return new SequenceExpression([]);
  }
}

class EffectInterpreter {
  constructor({ events, traits, time, eventLog } = {}) {
    this.events = events;
    this.traits = traits;
    this.time = time;
    this.eventLog = eventLog;
  }

  async run(effectDef, { timeCost } = {}) {
    const expr = EffectFactory.from(effectDef);
    const ctx = {
      events: this.events,
      traits: this.traits,
      time: this.time,
      eventLog: this.eventLog,
    };
    const result = await expr.interpret(ctx);

    const t = Number(timeCost);
    if (Number.isFinite(t) && t > 0 && this.events) {
      this.events.emit("effect", { time: t });
    }
    return result;
  }
}


module.exports = { EffectInterpreter };