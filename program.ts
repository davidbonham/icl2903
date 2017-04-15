/// <reference path="channel.ts" />
/// <reference path="ast.ts" />
/// <reference path="statements/end.ts" />

enum  ProgramState {Stopped, Interrupted, Input, Running}
class Program {

    protected _state : ProgramState = ProgramState.Stopped

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

    // A map from one line number to the next. It is computed when needed and
    // thought to be stale
    protected nextLineMap: number[]
    protected staleLineMap: boolean

    // Is the program in a state where it can be continued?
    protected continuable: boolean

    // The name of the program, set by NAME, GET commands &c
    protected name_: string
    public get name() { return this.name_ }
    public set name(name: string) { this.name_ = name }

    // The I/O channels as seen by this program. Channel 0 is the tty
    protected _channels: Channels
    public get channels() { return this._channels; }

    // Locations of user defined functions as a map from name to index
    protected udf: { [name: string]: number; }

    constructor(protected readonly session: Session.Session) {
        this.contents = []
        this.continuable = false
        this._state = ProgramState.Stopped
        this.name_ = ""
        this.udf = {}
        this.staleLineMap = true

        this._channels = new Channels
        this._channels.set(0, new TTYChannel(session))
    }

    public dump() {
        wto("program name=" + this.name_ + " continuable=" + this.continuable + " contents size=" + this.statementCount())
        this.contents.forEach(
            (statement: Statement, index: number) => {
                wto("index=" + index + " statement='" + statement.source() + "'")
            }
        )
    }

    public get state()  { return this._state}

    public breakIn() : void {
        this._state = ProgramState.Interrupted
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
        this.staleLineMap = true
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

        this.staleLineMap = true
    }

    protected nextStatementIndex(index: number) : number {

        // If the next array element exists, then that is the next one
        // otherwise we have reached the end of this line of statements
        // and need to locate the next line.

        // Fast check for next statement on this line
        if (this.contents[index+1] != undefined) {
            console.log("nextStatementIndex " + index + "->" + (index+1))
            return index+1
        }

        // We need to use the line map to advance to the next line so make
        // sure it is not stale
        let previousLineNumber : number = 0
        if (this.staleLineMap) {
            this.nextLineMap = []
            this.contents.forEach((value, index) => {
                if ((index % 100) == 0) {
                    // This is the start of a statement. If there was a previous
                    // line, set its map entry to this line
                    const line = index / 100
                    this.nextLineMap[previousLineNumber] = line
                    previousLineNumber = line
                }
            })

            // Complete the last entry - there is no following statement
            this.nextLineMap[previousLineNumber] = 0
            this.staleLineMap = false

            this.nextLineMap.forEach((value, index) => console.log("nextLineMap[" + index + "]=" + value))
        }

        // Get the next line number and convert it into its index
        console.log("nextStatementIndex " + index + "->" + (this.nextLineMap[index/100] * 100))
        return this.nextLineMap[index/100] * 100
    }

    protected closeChannels() : void {
        // No channel I/O yet
    }

    protected clearState(context: Context) : void {
        this.udf = {}
        this.closeChannels();
        context.clear();
    }

    protected checkLastStatementEnd() : void {

        // Start from the last used index and search backwrds for the last
        // defined entry. This is the last statement in the program
        for (let index = this.contents.length-1; index >= 0; --index) {

            if (this.contents[index] != undefined) {

                // If this is the start of a statement but the last in the
                // program, END must be the first child
                if (this.contents[index] instanceof SequenceStmt) {
                    if ((<SequenceStmt>this.contents[index]).statement instanceof EndStmt) return
                }

                // It might be the last in a sequence in which case this is
                // the expanded statement
                if (this.contents[index] instanceof EndStmt) return

                throw new Utility.RunTimeError(ErrorCode.NoEnd, index / 100)
            }
        }
    }

    // When we start running the BASIC program, we need to set all of the
    // variabled to be uninitialised (but dimensioned according to any DIM
    // statements and restore our data pointer to the start of the first DATA
    // statement.
    protected prepareProgram(context: Context) : void {

        // We're going to run the program so prepare data, dimensions &c. Any errors
        // need up be update to specify the current line number
        try {
            this.contents.forEach((value, index) => value.prepare(context, index/100))
        }
        catch (e) {
            throw new Utility.RunTimeError(e.error, e.index);
        }
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
            try {

                if (run) {
                    // Run from the specified line or the start if none specified
                    context.stmtIndex = line == 0 ? this.nextStatementIndex(0) : line*100
                    console.log("1 line=" + line + " stmtIndex=" + context.stmtIndex)
                }
                else {
                    // Continue from the specified line or the next if none specified
                    context.stmtIndex = line == 0 ? context.nextStmtIndex : line*100
                }


                if (this.contents[context.stmtIndex] != undefined) {

                    if (run) {

                        // Make sure any state kept from a previous interrupted run is discarded
                        //currentContext = new Context(None, this)
                        this.clearState(context);

                        // Before we start running we need to search the program and
                        // Make sure the program ends with END
                        this.checkLastStatementEnd();

                        // For each DIM statement, allocate its arrays
                        // For each DATA statement, queue its data
                        this.prepareProgram(context);
                    }

                    // We're starting this progam. If it has a name, print it
                    if (this.name != "") this.session.println(this.name)

                    // When we call step, we want to step onto the first
                    // statement in the program
                    context.nextStmtIndex = context.stmtIndex
                    this._state = ProgramState.Running

                    // We've run the program so it can be continued
                    this.continuable = true;
                }
                else {
                    this.session.println("LINE " + line + " DOES NOT EXIST");
                }
            }
            catch (e) {
                this.session.println("LINE " + e.line + " " + e.error);
            }
        }
    }

    public  step(context: Context) {

        let result = ErrorCode.NoError;

        try {
            wto("stepping to next index " + context.nextStmtIndex)
            context.stmtIndex = context.nextStmtIndex

            if (this.contents[context.stmtIndex] == undefined) throw new Utility.RunTimeError("CALLED LINE NUMBER DOES NOT EXIST");

            // The program is running and positioned at the next statement
            // to execute. Execute the current statement. If all goes well,
            // move on to the next statement for next time. Otherwise, if
            // there was an error, leave us positioned here.

            // Set up the default action of advancing to the next statement
            // in the context.
            context.nextStmtIndex = this.nextStatementIndex(context.stmtIndex)
            wto("setting its next to " + context.nextStmtIndex)

            // Execute the current statement
            this.contents[context.stmtIndex].execute(context)

            if (this.state == ProgramState.Interrupted) throw new Utility.RunTimeError("BREAK IN");

                //if (running) {
                //
                //  // Still running so advance to the next statement. A transfer of control
                //  // will be recorded in the context
                //  val candidate = indexOf(context.nextLineNumber)
                //  if (candidate == -1) throw new RunTimeError(0, "CALLED LINE NUMBER DOES NOT EXIST")
                //
                //  context.currentStatementIndex = candidate
                //}
            }
            catch (e)
            {
                if (e instanceof Error) throw e

                // Close all of the channels, whatever the reason for breaking.
                // This will ensure we are at the start of the line on all
                // terminal format channels.
                this._channels.closeChannels()

                // Now display the error on the session tty.
                result = e.error
                this.session.println("LINE " + (context.stmtIndex/100) + " " + e.error)
                this._state = ProgramState.Interrupted
            }


            // If there was an error, return it (although we have already displayed
            // it) to tell the caller it happened.
            return result;

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