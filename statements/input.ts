class InputStmt extends Statement {

    // When dealing with interactive input, we need to persist our position
    // in the list of input items between calls to our input handler
    protected nextItemNumber : number

    protected constructor(protected readonly channel: NumericExpression, protected readonly items: InputItem[]) {
        super()
    }

    public static parse(scanner: Scanner) : InputStmt {

        if (!scanner.consumeKeyword("INPUT")) return null

        const mark = scanner.mark();

        // First thing is an optional channel expression. If we see a #, we
        // must parse a valid channel expression or the statement is
        // incorrect.
        let channel : NumericExpression = null;
        if (scanner.consumeSymbol(TokenType.HASH)) {
            const nexpr = NumericExpression.parse(scanner)
            if (nexpr && scanner.consumeSymbol(TokenType.COLON)) {
                // Having successfully parsed #nexpr:, we have a channel;
                channel = nexpr;
            }
            else {
                return <InputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }
        }

        // Next we have the comma separated list of numeric or string
        // references.
        let items = []
        while (!scanner.atEos()) {
            let nref: NRef = null
            let sref: SRef = null
            if (nref = NRef.parse(scanner)) {
                items.push(new NumericItem(nref))
            }
            else if (sref = SRef.parse(scanner)) {
                items.push(new StringItem(sref))
            }
            else {
                // We're not at the end of the line so this is junk
                return <InputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }

            // If there is a comma, continue for the next item else we're
            // done.
            if (!scanner.consumeSymbol(TokenType.COMMA)) break
        }

        // There must be at least one item
        if (items.length == 0)
        {
            return <InputStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new InputStmt(channel, items)
    }

    public source() : string {
        const channelText = (this.channel != null) ? '#' + this.channel.source() + ":" : "";

        let itemsText = "";
        this.items.forEach((item) => {
            if (itemsText != "") itemsText += ','
            itemsText += item.source()
        })

        return "INPUT " + channelText + itemsText
    }

    protected tokeniseLine(text: string) : string[] {
        let tokens: string[] = []
        let quoted = false;
        let current = "";

        for (let ch of text) {
            // The next token exists and continues up to the next unquoted
            // comma or the end of the line. At the end of the line, we
            // may still be unquoted.
            if (ch == '"') {
                quoted = !quoted;
                current += ch;
            }
            else if (!quoted && ch == ',') {
                tokens.push(current);
                current = "";
            }
            else {
                current += ch;
            }
        }

        // If there is text here, it's the last item on the line
        if (current != "") tokens.push(current);

        return tokens
    }

    protected ensureItems(prompt: boolean, tty: TerminalChannel, tokens: string[])
    {
        while (tokens.length== 0) {
            if (prompt) tty.writes("? ")

            const text = tty.readline()

            // If the user typed break, we handle it here.
            if (text == '\x1a') throw new Utility.RunTimeError("BREAK IN")
            tokens = this.tokeniseLine(text)
        }
    }

    public execute(context: Context) : boolean
    {
        // The implementation of INPUT from the terminal required interaction
        // with the UI and that execution path is radically different from
        // the simple reading from files, so switch to the right implementation

        // If we are not reading from a channel we're reading from the terminal
        const channelNumber = this.channel == null ? 0 : Utility.round(this.channel.value(context))
        const channel = context.owner.channels.get(channelNumber)

        return channelNumber == 0 ? this.interactiveInput(context, <TTYChannel>channel)
                                  : this.fileInput(context, channel)
    }

    protected inputHandler(context: Context, tty: TerminalChannel, line: string) : boolean {

        // The UI has provided us with a line of text. Split it up into
        // tokens
        let tokens = this.tokeniseLine(line)

        for (const token of tokens) {

            // If we have run out of input items, the user has provided too
            // many, so we just discard them
            if (this.nextItemNumber > this.items.length) {
                tty.writes("EXTRA INPUT - WARNING ONLY\n")
                tty.eol()
                break
            }

            // Store this token in the next item. This can fail if it isn't
            // the right type
            if (this.items[this.nextItemNumber-1].store(context, token)) {

                // OK so advance to the next input item
                this.nextItemNumber++;
            }
            else {

                // This item is the wrong type. Flush this and the remaining
                // items and tell the user to type them again
                if (context.stmtIndex != 0) tty.writes("LINE " + (context.stmtIndex/100) + " ")
                tty.writes("BAD INPUT - RETYPE FROM ITEM " + this.nextItemNumber + "\n")
                break
            }
        }

        // If we still have input items left to process, we need more input
        // otherwise we can resume executng the next statement
        const more = this.nextItemNumber <= this.items.length
        if (more) {
            tty.writes("? ")
            tty.eol()
        }

        return more
    }

    protected interactiveInput(context: Context, tty: TTYChannel) : boolean {

        // We can;t do interactive input without the cooperation of the
        // session handler. Establush an input handler in the program and
        // switch its state to Input. This will cause subsequence session
        // ticks to pass any input to the handler until it is satisfied
        context.owner.setInputHandler((line: string) => this.inputHandler(context, tty, line))

        // Position ourselves to the first entry in the list of input items
        // (numbered in user's terms)
        this.nextItemNumber = 1

        // Make sure there's a prompt - we know we are interactive
        tty.writes("? ")
        tty.eol()
        return true
    }

    protected fileInput(context: Context, channel: Channel) : boolean {

        // The channel must be a terminal format (text, line structured)
        // file or a real terminal not an internal format (binary, record
        // structured) file
        if (!(channel instanceof TerminalChannel)) throw new Utility.RunTimeError(ErrorCode.FileWrongType);
        const tty = <TerminalChannel>channel

        // We read comma-separated input values a line at a time whenever we
        // discover we need more input. Keep the unread items here.
        let tokens : string[] = []

        this.nextItemNumber = 1
        for (const item of this.items) {
            for (;;) {
                // More items to input. Make sure we have at least one more token. Get
                // another line of comma-separated items and tokenise it if not. (Only
                // prompt for the interactive channel.)
                this.ensureItems(false, tty, tokens)

                // Get the next item and try to assign it to the current variable
                const token = tokens.shift()

                if (item.store(context, token)) {
                    this.nextItemNumber++;
                    break;
                }
                else {
                    // This item is the wrong type. Flush this and the remaining
                    //items and tell the user to type them again
                    tokens = []
                    tty.writes("LINE " + (context.stmtIndex/100) + " BAD INPUT - RETYPE FROM ITEM " + this.nextItemNumber + "\n");
                }
            }
        }

        // We're allowed to have items left over on the input line
        if (tokens.length > 0) {
            tty.writes("EXTRA INPUT - WARNING ONLY");
            tty.eol();
        }

        return true;
    }
}

abstract  class InputItem
{
    public abstract source() : string
    public abstract store(context: Context, token: string) : boolean
}

class NumericItem extends InputItem {

    public constructor(protected readonly nref: NRef) {
        super()
    }

    public source() : string {
        return this.nref.source()
    }

    public store(context: Context, token: string) : boolean {
        const value = parseFloat(token)
        if (Number.isNaN(value)) return false

        this.nref.set(context, value);
        return true;
    }
}

class StringItem extends InputItem {

    public constructor(protected readonly sref: SRef) {
        super()
    }

    public source() : string {
        return this.sref.source()
    }

    public store(context: Context, token: string) : boolean{
        this.sref.set$(context, token);
        return true;
    }
}
