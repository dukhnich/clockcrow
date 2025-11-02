class State {
  onEnter() {}
  onExit() {}
}
class NewGameState {
  onEnter(game) {
    game.handleNewGame();
  }
  onExit() {}
}

class ResultsState {
  onEnter(game) {
    game.handleHearResult();
  }
  onExit() {}
}
class FinishState extends State {
  onEnter(game) {
    game.view.exit();
  }
  onExit() {}
}

class GameOverState {
  onEnter(game) {
    if (typeof game.didHandleGameOver === "function" && game.didHandleGameOver()) return;
    game.handleGameOver();
  }
  onExit() {}
}
module.exports = { State, NewGameState, ResultsState, FinishState, GameOverState };