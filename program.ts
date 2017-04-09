
enum  ProgramState {Stopped, Interrupted, Input, Running}
class Program {

    protected state_ : ProgramState = ProgramState.Stopped

    // Our preogram is a sparse array of statement nodes, index by the line
    // number scaled by 100. Thus the line
    //
    // 355 PRINT "A"!PRINT "B!"!RETURN
    // 9999 END
    //
    // Is represented as
    //
    // contents[35500] = <print "A">
    // contents[35501] = <print "B">
    // contents[33502] = <return>
    // contents[999900] = <end>
    protected contents: Statement[]

    // Is the program in a state where it can be continued?
    protected continuable : boolean

    constructor(protected readonly session: Session.Session) {
        this.contents = []
        this.continuable = false
    }

    public get state()  { return this.state_}

    public breakIn() : void {
        this.state_ = ProgramState.Interrupted
    }

    public statementCount() : number {
        let count = 0
        for (let i in this.contents) count += 1
        return count
    }

    public lineCount() : number {
        let count = 0
        this.contents.forEach((statement: Statement, line: number) => {
            if ((line % 100) === 0) count += 1
        })
        return count
    }

    public run(line: number, context: Context, run: boolean) : void {
        if (this.lineCount() == 0) {
            this.session.println("NO PROGRAM");
        }
        else if (!run && !this.continuable) {
            // We've been asked to continue execution but we're not in a fit
            // state to do that
            this.session.println("NO PROGRAM");
        }
        else {
        }
    }

    public step() : void {
    }

    public stepInput(text: string) : void {
    }

}