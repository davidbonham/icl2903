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
        //return channel instanceof TTYChannel ? this.interactiveInput(context, channel)
        //                                     : this.fileInput(context, channel)
        return false
    }

    public compile(vm: Vm) {

        // Emit code to set the input channel and reset it ready for input
        if (this.channel) {
            this.channel.compile(vm)
        }
        else {
            vm.emit([Op.PUSH, 0])
        }
        vm.emit1(Op.SIC)

        // For each variable, we need to read a record and then assign it
        // to the string

        // Reset the input buffer for reading whole lines
        vm.emit1(Op.LIR)

        // Emit code to read a value for each item and store it
        this.variables.forEach(sref => {
            vm.emit1(Op.INS)
            sref.compileAssign(vm)
            vm.emit1(Op.DROP)
        })

        // Deal with any left over items
        vm.emit1(Op.INE)
    }
}
