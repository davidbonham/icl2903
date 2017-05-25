// CHAIN sexpr [WITH #nexpr [,#nexpr]*]? [, nexpr]?
//
// Replace the currently loaded program with that held in the file <sexpr>
// optionally preserving the state of the channels specified in the WITH
// clause. Start running the program from the first line or the line number
// that can be specified by the optional final nexpr.

class ChainStmt extends Statement {

    protected constructor(protected readonly name: StringExpression,
                          protected readonly channels: NumericExpression[],
                          protected readonly line: number) {
        super()
    }

    public static parse(scanner: Scanner) : ChainStmt {

        // Quickly abandon if not a CHAIN statement
        if (!scanner.consumeKeyword("CHAIN")) return null

        // Record the start of the statement to prevent subaequent parsers
        // accidentally parsing the remnents of a failed parse.
        const mark = scanner.mark()

        // Must have an expression for the name of the program
        const name = StringExpression.parse(scanner)
        if (!name) return <ChainStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)

        // Handle an optional WITH clause
        let channels : NumericExpression[] = []
        let afterComma = false
        if (scanner.consumeKeyword("WITH")) {

            for (;;) {

                // Try and parse another #<nexpr>. If there's no hash, we've
                // reached the end of the channels list
                if (!scanner.consumeSymbol(TokenType.HASH)) break

                // If we have a hash, there must be a channel
                const channel = NumericExpression.parse(scanner)
                if (!channel) return <ChainStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)

                // Note the channel
                channels.push(channel)

                // We may have a comma and if we do, it may be followed by the
                // next channel or it might be followed by a line number
                afterComma = scanner.consumeSymbol(TokenType.COMMA)
                if (!afterComma) break

                // Scanned the comma so loop and try the next channel
            }

            // Here, we have finished parsing the WITH clause so we must have
            // seen at least one channel
            if (channels.length == 0) return <ChainStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }
        else {
            // No with, but there might be a comma before a line number in
            // which case we need to consume it now so that both branches
            // of this if leave the scanner positioned after any comma
            afterComma = scanner.consumeSymbol(TokenType.COMMA)
        }

        // Here, if we have just seen a comma, there must be a line number
        let line = 0
        if (afterComma) {
            line = scanner.consumeLinenumber()
            if (!line) return <ChainStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new ChainStmt(name, channels, line)
    }

    public source() : string {

        let result = "CHAIN " + this.name.source()
        if (this.channels.length > 0) {
            result += " WITH #" + this.channels.map(n => n.source()).join(",#")
        }
        if (this.line > 0) {
            result += "," + this.line
        }
        return result
    }

    public execute(context: Context) : boolean {

        // We haven't implemented channel handling yet
        if (this.channels.length > 0) throw new Utility.RunTimeError(ErrorCode.NotImp)

        const root = context.root()
        const program = root.program

        // We need to replace the current program with the one held in memory
        const name = this.name.value(context)
        const loader = new FileLoader(program.session, name)

        const contents = loader.getRecords()
        if (typeof(contents) == "string") {
            throw new Utility.RunTimeError(contents)
        }
        else if (contents.type == 'B') {

            // Clear the existing program
            program.delete(1, Scanner.MAX_LINE)

            // Load the current program
            loader.loadBasic(contents.contents)
            program.name = name
            program.isData = false

            // Clear the existing contexts
            context.clear()

            // If we have a line number, set that as the next one else
            // atart from the beginning
            program.run(this.line, context, false)
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.FileWrongType)
        }

        return false
    }

    public compile(vm: Vm) {

        // As we don't yet implement propagation of channels, if there are
        // any we just compile the error
        if (this.channels.length > 0) {
            vm.emit([Op.ERR, ErrorCode.NotImp])
        }
        else {
            this.name.compile(vm)
            vm.emit([Op.PUSH, this.line])
            vm.emit1(Op.CHN)
        }
    }
}