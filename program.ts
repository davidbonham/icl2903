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
    // number
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
    protected currentInput: TerminalChannel
    protected currentOutput: TerminalChannel

    // Locations of user defined functions as a map from name to index
    protected udf: { [name: string]: number; }

    // For handling interactive input, the program must feed lines of input
    // to the pending input statement via this handler
    protected inputHandler: ((line: string) => boolean)

    protected vm : Vm

    // Map from a statement line number to the index  of its first generated
    // instruction
    protected vmmap : number[]


    constructor(public readonly session: Session.Session) {
        this.contents = []
        this.continuable = false
        this._state = ProgramState.Stopped
        this.name_ = ""
        this.isData = false
        this.udf = {}
        this.staleLineMap = true

        this._channels = new Channels
        this._channels.set(0, new TTYChannel(session))
        this.currentInput = <TerminalChannel>this._channels.get(0)
        this.currentOutput = <TerminalChannel>this._channels.get(0)
        this.vm = new Vm()
        this.vm.clear()
        this.vmmap = []
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
        this.session.println("LINE " + this.vmLine() + " BREAK IN" )
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
            count += 1
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
            count += statement.source().length + 4
        })

        return count
    }


    public lines(from: number, to: number) : Statement[] {

        // Convert line numbers to indices
        const low = from
        const high = to

        // Return statements in the range ignoring statement sequence
        // expansions. Convert indices to line numbers
        let result : Statement[] = []
        this.contents.forEach(
            (statement : Statement, index: number) => {
                if (low <= index && index <= high) {
                    result[index] = statement
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

        this.contents[lineNo] = statement
        this.staleLineMap = true
    }

    public delete(from: number, to: number) : void {

        // We've changed the program so it needs to be run again before it
        // can be continued
        this.continuable = false;

        // We have been given line numbers so convert these to the largest
        // range of indices
        const low = from
        const high = to - 1

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
                // This is the main statement of each line, work out its
                // new line number and add it to the map
                lineMap[index] = start + count*step
                count += 1
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

                const currentLine = lineMap[index]
                currentIndex = currentLine

                newContents[currentIndex] = stmt
            })

            // We've changed the program so it needs to be run again before
            // it can be continued and we have also invalidated the line map
            this.contents = newContents
            this.continuable = false
            this.staleLineMap = true
        }
    }

    public declareUdf(name: string, line: number) {
        this.udf[name] = line
    }

    public getUdf(name: string) : DefStmt {

        // Find the first line of the user defined function and then get
        // its first statement
        if (name in this.udf) {
            const line = this.udf[name]
            const sequence = this.contents[line]
            if (sequence instanceof SequenceStmt) {
                const first = sequence.statement
                if (first instanceof DefExpStmtN || first instanceof DefExpStmtS) {
                    return first
                }
            }

            // If the name was declared, we shouln't get here
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }

        // We don;t know about this function
        throw new Utility.RunTimeError(ErrorCode.NoUDF)
    }
    protected nextStatementIndex(index: number) : number {

        // We need to use the line map to advance to the next line so make
        // sure it is not stale
        let previousLineNumber : number = 0
        if (this.staleLineMap) {
            this.nextLineMap = []
            this.contents.forEach((value, index) => {
                // This is the start of a statement. If there was a previous
                // line, set its map entry to this line
                this.nextLineMap[previousLineNumber] = index
                previousLineNumber = index
            })

            // Complete the last entry - there is no following statement
            this.nextLineMap[previousLineNumber] = 0
            this.staleLineMap = false

            this.nextLineMap.forEach((value, index) => console.log("nextLineMap[" + index + "]=" + value))
        }

        // Get the next line number and convert it into its index
        return this.nextLineMap[index]
    }

    protected closeChannels() : void {
        // No channel I/O yet
        this.currentInput = <TerminalChannel>this._channels.get(0)
        this.currentOutput = <TerminalChannel>this._channels.get(0)
    }

    public setInputChannel(channel: TerminalChannel) {
        this.currentInput = channel
    }

    public setOutputChannel(channel: TerminalChannel) {
        this.currentOutput = channel
    }

    public getOutputChannel() : TerminalChannel{
        return this.currentOutput
    }

    public getInputChannel() : TerminalChannel{
        return this.currentInput
    }

    protected clearState(context: Context) : void {
        this.udf = {}
        this.closeChannels();
        context.clear();
        this.vm.clear()
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

                throw new Utility.RunTimeError(ErrorCode.NoEnd, index)
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
        this.contents.forEach((value, index) => {
            try {
                value.prepare(context, index)
            }
            catch (e) {
                if (e instanceof Utility.RunTimeError) {
                    throw new Utility.RunTimeError(e.error, index)
                }
                else {
                    throw e
                }
            }
        })
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

    /**
     * Find the FNEND statement matching this DEF.
     *
     * Advance from the current statement (which is expected to be a DEF)
     * until we find an FNEND. We return the statement number. We also
     * check that none of the intervening statements is another DEF or an
     * END statement.
     *
     * We need to deal in statement indices rather than line numbers so
     * that the following will work:
     *
     * 10 DEF FNA(X)!FNA=4!FNEND
     *
     * @param defStmt: line number of the def statement
     */
    public findFnend(defStmt: number) : number {

        // Iterate over the expanded statement in line number order
        const defIndex = defStmt
        for (let nextIndex = this.nextStatementIndex(defIndex); nextIndex != 0; nextIndex = this.nextStatementIndex(nextIndex)) {

            let statement: Statement = this.contents[nextIndex]

            // Deal with statement sequences by inspecting only the first
            if (statement instanceof SequenceStmt) {
                statement = statement.statement
            }

            // If this is a NEXT statement specifying the same variable,
            // we have found the answer
            if (statement instanceof FnendStmt) {
                return nextIndex
            }
            else if (statement instanceof DefStmt || statement instanceof EndStmt) {
                throw new Utility.RunTimeError(ErrorCode.DefInDef)
            }
        }

        // We didn't find an FNEND after this DEF
        throw new Utility.RunTimeError(ErrorCode.DefNoFnend)
    }

    public lineForPc(wanted: number) : number {
        let previousLine : number

        // The indices are line numbers so this is almost always a very
        // sparse array, typically 9 our of 10 indices unused, hence forEach
        this.vmmap.forEach((pc, line) => {
            if (pc > wanted) {
                // This line starts after the wanted PC so the previous
                // line is the one we want.
                return previousLine
            }
            previousLine = line
        })

        // Here, we didn't find a line with a PC later than the wanted one
        // so we must want the last line in the program
        return previousLine
    }

    public vmLine() : number {
        const wantedPC = this.vm.getPC() - 1
        return this.lineForPc(wantedPC)
    }

    public pcForLine(line: number) {
        return line in this.vmmap ? this.vmmap[line] : null
    }

    public resume(line: number, context: Context, showName: boolean) : void {

        if (!this.continuable) {
            this.session.println("NO PROGRAM")
            return
        }

        if (line) {

            // The user wants to continue from this line number. We
            // need to make sure it exists and the set position the
            // VM to the first code in that statement.
            if (!(line in this.vmmap)) {
                this.session.println("LINE " + line + " DOES NOT EXIST");
                return
            }

            this.vm.goto(this.vmmap[line])
        }

        // We're starting this progam. If it has a name, print it
        if (showName && this.name != "") this.session.println(this.name)
        this._state = ProgramState.Running
    }

    public run(line: number, context: Context, showName: boolean) : void {

        if (this.lineCount() == 0) {
            this.session.println("NO PROGRAM");
            return
        }

        try {

            // Make sure any state kept from a previous interrupted run is discarded
            this.clearState(context);

            // Before we start running we need to search the program and
            // Make sure the program ends with END
            this.checkLastStatementEnd();

            // Compile each statement into object code
            this.compile()

            // For each DIM statement, allocate its arrays
            // For each DATA statement, queue its data
            this.prepareProgram(context)

            // Run from the specified line or the start if none specified
            const fromLine = line == 0 ? this.nextStatementIndex(0) : line
            if (!(fromLine in this.vmmap)) {
                // The specified line does not exist
                this.session.println("LINE " + line + " DOES NOT EXIST");
                return
            }

            this.vm.goto(this.vmmap[fromLine])

            // We're starting this progam. If it has a name, print it
            if (showName && this.name != "") this.session.println(this.name)

            this._state = ProgramState.Running

            // We've run the program so it can be continued
            this.continuable = true;
        }
        catch (e) {
            if (e instanceof Error) throw e
            this.session.println("LINE " + e.line + " " + e.error);
        }
    }

    public step(context: Context, line: string) {
        let result = ErrorCode.NoError;

        try {

            if (this._state == ProgramState.Running) {

                // The program is running and positioned at the next statement
                // to execute. Execute some operations. This will terminate if
                // we need to interact to allow a line to be printed or
                // input read from the terminal.
                this.vm.step(10, context)
            }
            else {
                // Input has been provided for the current input statement
                this.vm.inputLine(line)
                this._state = this._oldState
            }
        }
        catch (e)
        {
            if (e instanceof Error) throw e

            // Close all of the channels, whatever the reason for breaking.
            // This will ensure we are at the start of the line on all
            // terminal format channels.
            this._channels.closeChannels()
            this._state = ProgramState.Interrupted
            result = e.error

            // Now display the error on the session tty. Get the current pc
            // from the vm and look up the line number
            this.session.println("LINE " + this.vmLine() + " " + e.error)
        }

        // If there was an error, return it (although we have already displayed
        // it) to tell the caller it happened.
        return result;
    }

    public setImmediateStatement(statement: Statement) {

        // Note the current end of the object code so it can be restored
        // at the end
        const end = this.vm.mark(0)

        // Compile the immediate statement onto the end of the object code
        // and terminate it with an EIS (end immediate statement)
        statement.compile(this.vm)
        this.vm.emit([Op.EIS, end])

        // Now call it as if it were a subroutine
        this.vm.goto(end)
    }
    public setInputHandler(handler: (line: string) => boolean) {
        this.inputHandler = handler
        this._oldState = this._state
        this._state = ProgramState.Input
    }

    public needInput() : void {
        this._oldState = this._state
        this._state = ProgramState.Input
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

    public compile() {

        this.vm.clear()
        this.vmmap = []
        this.contents.forEach((statement, index) => {

            // Record the location of this line in the map
            this.vmmap[index] = this.vm.mark(0)
            statement.compile(this.vm)
            wto("vm " + this.vmmap[index] + ": " + index + " " + statement.source())
        })

        // Resolve any unknown locations in the object code
        this.vm.prepare(this)
        this.vm.dump()
    }
}