class Expression {
  async interpret(ctx) {
    return null;
  }
}

class Interpreter extends Expression {
  constructor() {
    super();
  };

  async interpret(ctx) {
    return null;
  }
}

module.exports = { Expression, Interpreter };