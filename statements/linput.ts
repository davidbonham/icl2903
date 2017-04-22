class LinputStmt extends Statement {

    // When dealing with interactive input, we need to persist our position
    // in the list of input items between calls to our input handler
    protected nextItemNumber : number

    protected constructor(protected readonly channel: NumericExpression, protected readonly variables: SRef[]) {
        super()
    }

    public static parse(scanner: Scanner) : LinputStmt {

        if (!scanner.consumeKeyword("LINPUT")) return null

        const mark = scanner.mark()

        // First thing is an optional channel expression. If we see a #, we
        // must parse a valid channel expression or the statement is
        // incorrect.
        let channel : NumericExpression = null

        if (scanner.consumeSymbol(TokenType.HASH))
        {
            let nexpr: NumericExpression
            if ((nexpr = NumericExpression.parse(scanner))
            &&  scanner.consumeSymbol(TokenType.COLON)) {
                // Having successfully parsed #nexpr:, we have a channel;
                channel = nexpr;
            }
            else {
                return <LinputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }
        }

        // Next we have the comma separated list of string references.
        let srefs : SRef[] = []
        while (!scanner.atEos())
        {
            const sref = SRef.parse(scanner)
            if (sref) {
                srefs.push(sref)
            }
            else {
                // We're not at the end of the line so this is junk
                return <LinputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }

            // If there is a comma, continue for the next item else we're
            // done.
            if (!scanner.consumeSymbol(TokenType.COMMA)) break;
        }

        // There must be at least one item
        if (srefs.length == 0) {
            return <LinputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new LinputStmt(channel, srefs)
    }

    public source() : string {
        const channelText = (this.channel != null) ? '#' + this.channel.source() + ":" : "";
        const itemsText = this.variables.map((s: SRef) => s.source()).join(",")
        return "LINPUT " + channelText + itemsText
    }

    public execute(context: Context ) : boolean {

        // Work out the channel number and get it out of the program's
        // open channels
        const channelNumber = this.channel == null ? 0 : Utility.round(this.channel.value(context))
        const channel = context.owner.channels.get(channelNumber)

        // We must be connected to a terminal format file
        if (!(channel instanceof TerminalChannel)) throw new Utility.RunTimeError(ErrorCode.FileWrongType)

        // Interactive input from a tty must be handled via the UI callback
        // mechanism
        return channel instanceof TTYChannel ? this.interactiveInput(context, channel)
                                             : this.fileInput(context, channel)
    }

    protected interactiveInput(context: Context, tty: TTYChannel) : boolean {

        // We can;t do interactive input without the cooperation of the
        // session handler. Establush an input handler in the program and
        // switch its state to Input. This will cause subsequence session
        // ticks to pass any input to the handler until it is satisfied
        context.owner.setInputHandler((line: string) => this.inputHandler(context, tty, line))

        // Position ourselves to the first entry in the list of input items
        this.nextItemNumber = 0

        // Make sure there's a prompt - we know we are interactive
        tty.writes("? ")
        tty.eol()
        return true
    }

    protected inputHandler(context: Context, tty: TerminalChannel, line: string) : boolean {

        // The UI has provided us with a line of text. There should be another
        // variable awaiting its value or we have made a mistake
        if (this.nextItemNumber >= this.variables.length) {
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }

        this.variables[this.nextItemNumber].set$(context, line)
        this.nextItemNumber++

        // If we still have input items left to process, we need more input
        const more = this.nextItemNumber < this.variables.length
        if (more) {
            tty.writes("? ")
            tty.eol()
        }

        return more
    }

    protected fileInput(context: Context, channel: TerminalChannel) : boolean {
        throw new Utility.RunTimeError(ErrorCode.NotImp)
    }
}
