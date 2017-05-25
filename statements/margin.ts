class MarginStmt extends Statement {

    protected constructor(protected readonly channel: NumericExpression, protected readonly margin: NumericExpression) {
        super()
    }

    public source() : string{
        const channelText = (this.channel != null) ? '#' + this.channel.source() + ": " : "";
        return "MARGIN " + channelText + this.margin.source();
    }

    public compile(vm: Vm) {

        // Evaluate the channel
        if (this.channel) {
            this.channel.compile(vm)
        }
        else {
            vm.emit([Op.PUSH, 0])
        }

        // Evaluate the margin expression
        this.margin.compile(vm)

        // Set the margin
        vm.emit1(Op.MRG)
    }

    public static parse(scanner: Scanner) : MarginStmt {

        if (!scanner.consumeKeyword("MARGIN")) return null

        const mark = scanner.mark();

        // First thing is an optional channel expression. If we see a #, we
        // must parse a valid channel expression or the statement is
        // incorrect.
        let channel : NumericExpression
        if (scanner.consumeSymbol(TokenType.HASH)) {
            // There's a hash so there must be a channel expression
            if (!((channel = NumericExpression.parse(scanner)) && scanner.consumeSymbol(TokenType.COLON))) {
                return <MarginStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }
        }

        // Next, the margin expression is required
        const margin = NumericExpression.parse(scanner)
        if (!margin) {
            return <MarginStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new MarginStmt(channel, margin)
    }
}
