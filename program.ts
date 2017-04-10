
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

    protected name_: string
    public get name() { return this.name_ }

    constructor(protected readonly session: Session.Session) {
        this.contents = []
        this.continuable = false
        this.name_ = undefined
    }

    public dump() {
        wto("program name=" + this.name_ + " continuable=" + this.continuable + " contents size=" + this.statementCount())
        this.contents.forEach(
            (statement: Statement, index: number) => {
                wto("index=" + index + " statement='" + statement.source() + "'")
            }
        )
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

    public lines(from: number, to: number) : Statement[] {

        // Convert line numbers to indices
        const low = from*100
        const high = to*100

        // Return statements in the range ignoring statement sequence
        // expansions. Convert indices to line numbers
        let result : Statement[] = []
        this.contents.forEach(
            (statement : Statement, index: number) => {
                if (low <= index && index <= high && (index % 100) == 0) {
                    result[index/100] = statement
                }
            }
        )

        return result
    }

    public add(lineNo: number, statement: Statement) : void {

        // We've changed the program so it needs to be run again before it
        // can be continued
        this.continuable = false;

        // Delete any line at this number
        this.delete(lineNo, lineNo)

        // Simple statements can be inserted immediately but sequences must
        // be expanded
        this.contents[lineNo*100] = statement

        if (statement instanceof SequenceStmt) {
            let offset = 1
            for (let node : SequenceStmt = statement.next; node != null; node = node.next) {
                this.contents[lineNo*100+offset] = node.statement
                offset++
            }
        }
    }

    public delete(from: number, to: number) : void {

        // We've changed the program so it needs to be run again before it
        // can be continued
        this.continuable = false;

        // We have been given line numbers so convert these to the largest
        // range of indices
        const low = from * 100
        const high = to*100 + 99

        // Keep lines not in that range
        let result : Statement[] = []
        this.contents.forEach(
            (statement, index) => {
                if (index < low || high < index) {
                    result[index] = statement
                }
            }
        )
        this.contents = result
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

    public terminate() {
        // Wind down at the end of a program. There may be pending output
        // on the terminal and file channels
        //System.Diagnostics.Debug.Assert(context._owner._channels.get(0) is TerminalChannel);
        //    TerminalChannel tty = (TerminalChannel)context._owner._channels.get(0);
        //    tty.writes("");
        //    tty.eol();
        this.session.crlf()
    }
}