/// <reference path="channel.ts" />
/// <reference path="ast.ts" />
/// <reference path="statements/end.ts" />

enum  ProgramState {Stopped, Interrupted, Input, Running}
class Program {

    // The current state of the program and, if an INPUT statement is
    // executing, what the previous state was
    protected _state    : ProgramState = ProgramState.Stopped
    protected _oldState : ProgramState


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

    // Is this a data file rather than a basic program?
    public isData: boolean

    // The I/O channels as seen by this program. Channel 0 is the tty
    protected _channels: Channels
    public get channels() { return this._channels; }

    // Locations of user defined functions as a map from name to index
    protected udf: { [name: string]: number; }

    // For handling interactive input, the program must feed lines of input
    // to the pending input statement via this handler
    protected inputHandler: ((line: string) => boolean)

    constructor(protected readonly session: Session.Session) {
        this.contents = []
        this.continuable = false
        this._state = ProgramState.Stopped
        this.name_ = ""
        this.isData = false
        this.udf = {}
        this.staleLineMap = true

        this._channels = new Channels
        this._channels.set(0, new TTYChannel(session))
    }

    /**
     * Convert an index in the contents array to its line number
     *
     * Because we expand statement sequences into individial statements
     * before execution, we scale line numbers by 100 to allow these to
     * be stored between lines:
     *
     * 10 A=1!B=2!c=3       =>    1000 A=1
     * 99 END                     1001 B=1
     *                            1001 C=2
     *                            9900 END
     *
     * Map the index we are given into its owning line number
     *
     * @param index
     */
    protected static indexToLine(index: number) : number {
        return Math.floor(index / 100)
    }

    /**
     * Convert a line number into its statement index in the contents array
     *
     * @param line a line number in the range 1..9999
     */
    protected static lineToIndex(line: number) : number {
        return line*100
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

    public breakIn(context: Context) : void {

        // Because an INPUT handler may be running and not being ticked,
        // we need to handle that specially here, alas.
        if (this._state == ProgramState.Input) {
            this.session.println("/Z/")
        }

        // Close all of the channels, whatever the reason for breaking.
        // This will ensure we are at the start of the line on all
        // terminal format channels.
        this._channels.closeChannels()

        // Now display the interrupt on the session tty.
        this.session.println("LINE " + Program.indexToLine(context.stmtIndex) + " BREAK IN" )
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

    public size() : number {
        // The size of our program is approximated by adding together the
        // lengths of the sources of the lines, adding in four bytes for
        // the line number. Note that we ignore statements generated from
        // expanding each line.
        let count = 0
        this.contents.forEach((statement: Statement, line: number) => {
            if ((line % 100) === 0) count += statement.source().length + 4
        })

        return count
    }


    public lines(from: number, to: number) : Statement[] {

        // Convert line numbers to indices
        const low = Program.lineToIndex(from)
        const high = Program.lineToIndex(to)

        // Return statements in the range ignoring statement sequence
        // expansions. Convert indices to line numbers
        let result : Statement[] = []
        this.contents.forEach(
            (statement : Statement, index: number) => {
                if (low <= index && index <= high && (index % 100) == 0) {
                    result[Program.indexToLine(index)] = statement
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
        this.contents[Program.lineToIndex(lineNo)] = statement

        if (statement instanceof SequenceStmt) {
            let offset = 1
            for (let node : SequenceStmt = statement.next; node != null; node = node.next) {
                this.contents[Program.lineToIndex(lineNo)+offset] = node.statement
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
        const low = Program.lineToIndex(from)
        const high = Program.lineToIndex(to+1) - 1

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

    /**
     * Renumber the contents of the program, taking account of line numbers
     * present in control flow statements like GOTO and ON n GOSUB. Any
     * statement sequences in the program have been expanded in line and
     * these need to be treated specially.
     *
     * @param start  the line number for the first line in the contents
     * @param step   the step size between line numbers
     */
    public renumber(start: number, step: number) : void {

        // Befoew we do anyting, make sure that the final line will have
        // a statement number that is small enough to be legal.
        var lastNumber = start + step * this.lineCount()
        if (lastNumber > Scanner.MAX_LINE) {
            this.session.println("EXCEEDS LINE " + Scanner.MAX_LINE)
        }
        else {

            // Build a map from the old line numbers to the new ones
            let lineMap : number[] = []
            let count = 0
            this.contents.forEach((stmt: Statement, index: number) => {

                if ((index % 100) == 0) {

                    // This is the main statement of each line, work out its
                    // new line number and add it to the map
                    lineMap[Program.indexToLine(index)] = start + count*step
                    count += 1
                }
            })

            // Now ask each statement to renumber itself. We need to consider
            // all statements, not just those at the start of the line as
            // a line number could appear anywhere
            this.contents.forEach((stmt: Statement, index: number) => {
                stmt.renumber(lineMap)
            })

            // Finally, renumber all of the lines. We must consider all of
            // the expanded statements too.
            let newContents : Statement[] = []
            let currentIndex : number
            let nextExpansion : number
            this.contents.forEach((stmt: Statement, index: number) => {

                // Work out the new index for this statement
                if ((index % 100) == 0) {

                    // This is the first statement in the line. It's new
                    // line number comes from the line map
                    const currentLine = lineMap[Program.indexToLine(index)]
                    currentIndex = Program.lineToIndex(currentLine)
                }
                else {
                    // This is an expansion statement so it goes one index
                    // after the previous statement
                    currentIndex += 1
                }

                newContents[currentIndex] = stmt
            })

            // We've changed the program so it needs to be run again before
            // it can be continued and we have also invalidated the line map
            this.contents = newContents
            this.continuable = false
            this.staleLineMap = true
        }
    }

    protected nextStatementIndex(index: number) : number {

        // If the next array element exists, then that is the next one
        // otherwise we have reached the end of this line of statements
        // and need to locate the next line.

        // Fast check for next statement on this line
        if (this.contents[index+1] != undefined) {
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
                    const line = Program.indexToLine(index)
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
        return Program.lineToIndex(this.nextLineMap[Program.indexToLine(index)])
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

                throw new Utility.RunTimeError(ErrorCode.NoEnd, Program.indexToLine(index))
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
            this.contents.forEach((value, index) => value.prepare(context, Program.indexToLine(index)))
        }
        catch (e) {
            throw new Utility.RunTimeError(e.error, e.index);
        }
    }

    /**
     * Find the NEXT statement matching this FOR.
     *
     * Advance from the current statement (which is expected to be a FOR)
     * until we find a NEXT (which ought to match it). We return the statement
     * number so that the caller can transfer control to it. When it is
     * executed, we will discover if there is a problem
     *
     * We need to deal in statement indices rather than line numbers so
     * that the following will work:
     *
     * 10 FOR I=1 TO 10!PRINT I!NEXT I
     *
     * @param forStmt index of the for statement in our contents
     * @param index   the refernce to the loop index variable
     */
    public findNext(forStmt: number, index: NScalarRef) : number {

        // Iterate over the expanded statement in line number order
        let nextIndex = forStmt
        for (let nextIndex = forStmt; nextIndex != 0; nextIndex = this.nextStatementIndex(nextIndex)) {

            let statement: Statement = this.contents[nextIndex]

            // Deal with statement sequences by inspecting only the first
            if (statement instanceof SequenceStmt) {
                statement = statement.statement
            }

            // If this is a NEXT statement specifying the same variable,
            // we have found the answer
            if (statement instanceof NextStmt) {
                if (statement.index.same(index)) {
                    return nextIndex
                }
            }
        }

        // We didn't find a next after this for
        throw new Utility.RunTimeError(ErrorCode.ForUnmatched)
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
                    context.stmtIndex = line == 0 ? context.nextStmtIndex : Program.lineToIndex(line)
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

    public  step(context: Context, line: string) {

        let result = ErrorCode.NoError;

        try {

            if (this._state == ProgramState.Running) {
                context.stmtIndex = context.nextStmtIndex

                if (this.contents[context.stmtIndex] == undefined) throw new Utility.RunTimeError("CALLED LINE NUMBER DOES NOT EXIST");

                // The program is running and positioned at the next statement
                // to execute. Execute the current statement. If all goes well,
                // move on to the next statement for next time. Otherwise, if
                // there was an error, leave us positioned here.

                // Set up the default action of advancing to the next statement
                // in the context.
                context.nextStmtIndex = this.nextStatementIndex(context.stmtIndex)

                // Execute the current statement
                wto("index=" + context.stmtIndex + ": " + this.contents[context.stmtIndex].source())
                this.contents[context.stmtIndex].execute(context)
            }
            else {
                // Input has been provided for the current input statement
                const more = this.inputHandler(line)
                this._state = more ? ProgramState.Input : this._oldState
            }

            //if (this.state == ProgramState.Interrupted) throw new Utility.RunTimeError("BREAK IN");

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
            this.session.println("LINE " + Program.indexToLine(context.stmtIndex) + " " + e.error)
            this._state = ProgramState.Interrupted
        }


        // If there was an error, return it (although we have already displayed
        // it) to tell the caller it happened.
        return result;
    }

    public setInputHandler(handler: (line: string) => boolean) {
        this.inputHandler = handler
        this._oldState = this._state
        this._state = ProgramState.Input
    }

    public stepInput(text: string) : void {
        const more = this.inputHandler(text)
        this._state = more ? ProgramState.Input : this._oldState
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