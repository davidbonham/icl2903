class ReadStmt extends Statement {

    protected constructor(protected readonly channel: NumericExpression, protected readonly items: InputItem[]) {
        super()
    }

    public static parse(scanner: Scanner) : ReadStmt {

        if (!scanner.consumeKeyword("READ")) return null

        const mark = scanner.mark()

        // First thing is an optional channel expression. If we see a #, we
        // must parse a valid channel expression or the statement is
        // incorrect.
        let channel : NumericExpression = null
        if (scanner.consumeSymbol(TokenType.HASH)) {

            let nexpr : NumericExpression
            if ((nexpr = NumericExpression.parse(scanner))
            &&   scanner.consumeSymbol(TokenType.COLON)) {
                // Having successfully parsed #nexpr:, we have a channel
                channel = nexpr
            }
            else {
                // Looks like a syntax error
                scanner.restore(mark)
                return null
            }
        }

        // Next we have the comma separated list of numeric or string
        // references.
        let items : InputItem[] = []
        while (!scanner.atEos()) {
            let nref: NRef
            let sref: SRef
            if ((nref = NRef.parse(scanner))) {
                items.push(new NumericItem(nref))
            }
            else if ((sref = SRef.parse(scanner))) {
                items.push(new StringItem(sref))
            }
            else {
                // We're not at the end of the line so this is junk
                scanner.restore(mark)
                return null
            }

            // If there is a comma, continue for the next item else we're
            // done.
            if (!scanner.consumeSymbol(TokenType.COMMA)) break;
        }

        // There must be at least one item
        if (items.length == 0) {
            scanner.restore(mark)
            return null
        }

        return new ReadStmt(channel, items)
    }

    public source() : string {
        const channelText = (this.channel != null) ? '#' + this.channel.source() + ":" : ""
        const itemsText = this.items.map(item => item.source()).join(",")
        return "READ " + channelText + itemsText
    }


    public execute(context: Context) : boolean  {

        // Read with a channel reads a binary record from a file, which
        // isn't working yet
        if (this.channel != null) throw new Utility.RunTimeError(ErrorCode.NotImp)

        this.items.forEach(item => {

            // Check there's at least one more item to read
            if (!context.data.more()) throw new Utility.RunTimeError(ErrorCode.ReadBeyond)

            // Take the item from the data stream
            const datum = context.data.nextDatum()

            // Type checking
            if (item instanceof NumericItem && datum instanceof NDatum) {
                item.store(context, datum.value())
            }
            else if (item instanceof StringItem && (datum instanceof SDatum)) {
                // An SDatum or UDatum
                item.store(context, datum.value())
            }
            else {
                throw new Utility.RunTimeError(ErrorCode.BadInput)
            }
        })

        return true;
    }
}

