export class State {
    handle() {}
}

export class InitialState extends State {
    handle() {
        console.log("InitialState: handle");
    }
}
export default { State, InitialState };