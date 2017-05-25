class InputStmt extends Statement {

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

    public static SIC(context: Context, channel: number) {
        const channelNumber = Utility.round(channel)
        context.root().setInputChannel(<TerminalChannel>context.root().channels.get(channelNumber))
    }

    public compile(vm: Vm) {

        // Emit code to set the input channel and reset it ready for input
        if (this.channel) {
            this.channel.compile(vm)
        }
        else {
            vm.emit([Op.PUSH, 0])
        }
        vm.emit([Op.SIC, Op.INR])

        // Emit code to read a value for each item and store it
        this.items.forEach(item => item.compile(vm, false))

        // Deal with any left over items
        vm.emit1(Op.INE)
    }

}

abstract  class InputItem
{
    public abstract source() : string
    public abstract compile(vm: Vm, isData: boolean) : void
}

class NumericItem extends InputItem {

    public constructor(protected readonly nref: NRef) {
        super()
    }

    public source() : string {
        return this.nref.source()
    }

    public compile(vm: Vm, isData: boolean) {
        // Arrange for a number to be read and placed on the top of the
        // stack
        vm.emit1(isData ? Op.RDN : Op.INN)

        // Assign to the variable. Because assignment normally leaves the
        // value on the stack, drop it explicitly
        this.nref.compileAssign(vm)
        vm.emit1(Op.DROP)
    }
}

class StringItem extends InputItem {

    public constructor(protected readonly sref: SRef) {
        super()
    }

    public source() : string {
        return this.sref.source()
    }

    public compile(vm: Vm, isData: boolean) {
        // Arrange for a string to be read and placed on the top of the
        // stack
        vm.emit1(isData ? Op.RDS : Op.INS)

        // Assign to the variable. Because assignment normally leaves the
        // value on the stack, drop it explicitly
        this.sref.compileAssign(vm)
        vm.emit1(Op.DROP)
    }
}
