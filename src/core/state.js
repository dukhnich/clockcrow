class State {
    handle() {}
}

class InitialState extends State {
    handle() {
        console.log("InitialState: handle");
    }
}
module.exports = { State, InitialState };