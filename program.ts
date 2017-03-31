
enum  ProgramState {Stopped, Interrupted, Input, Running}
class Program {

    private state_ : ProgramState = ProgramState.Stopped
    constructor() {}

    public get state()  { return this.state_}

    public breakIn() : void {
        this.state_ = ProgramState.Interrupted
    }

    public step() : void {  
    }

    public stepInput(text: string) : void {  
    }

}