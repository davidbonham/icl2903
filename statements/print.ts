/// <reference path="../ast.ts" />

abstract class PrintItem {
    public abstract source() : string
    public abstract compile(vm: Vm) : void
}

class PrintComma extends PrintItem {

    public source() : string {
        return ",";
    }

    public compile(vm: Vm) {
        vm.emit1(Op.TTC)
    }
}


class PrintSemi extends PrintItem {

    public source() : string {
        return ";";
    }

    public compile(vm: Vm) {
        // Nothing to perform
    }

}

class PrintTab extends PrintItem {

    public constructor(protected readonly tab: NumericExpression) {
        super()
    }

    public source() : string {
        return "TAB(" + this.tab.source() + ")";
    }

    public compile(vm: Vm) {
        // Evaluate the tab setting
        this.tab.compile(vm)
        // Then tab to it
        vm.emit1(Op.TTT)
    }

}

class PrintN extends PrintItem {

    public constructor(protected readonly value: NumericExpression){
        super()
    }

    public source() : string {
        return this.value.source();
    }

    public compile(vm: Vm) {
        this.value.compile(vm)
        vm.emit1(Op.TTN)
    }
}

class PrintLine extends PrintItem {

    public source() : string {
        return ""
    }

    public compile(vm: Vm) {
        vm.emit1(Op.TTL)
    }
}

class PrintS extends PrintItem {

    public constructor(protected readonly value: StringExpression) {
        super()
    }

    public source() : string {
        return this.value.source();
    }

    public compile(vm: Vm) {
        this.value.compile(vm)
        vm.emit1(Op.TTS)
    }

}

class PrintStmt extends Statement {

    protected constructor(protected readonly channel: NumericExpression,
                          protected readonly using: StringExpression,
                          protected readonly items: PrintItem[]) {
        super()
    }

    public static parse(scanner: Scanner) : PrintStmt {

        const mark = scanner.mark();
        if (!scanner.consumeKeyword("PRINT")) return null

        // First thing is an optional channel expression. If we see a #, we
        // must parse a valid channel expression or the statement is
        // incorrect.
        let channel: NumericExpression = null;
        if (scanner.consumeSymbol(TokenType.HASH)) {
            let nexpr: NumericExpression = NumericExpression.parse(scanner)

            if (nexpr && scanner.consumeSymbol(TokenType.COLON)) {
                // Having successfully parsed #nexpr:, we have a channel;
                channel = nexpr;
            }
            else {
                return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark);
            }
        }

        //  Next, there may be an optional USING clause. If we see USING, we
        // must parse a valid clause or the statement is incorrect
        let using_expr: StringExpression = null;
        if (scanner.consumeKeyword("USING")) {
            const sexpr = StringExpression.parse(scanner)
            if(sexpr && scanner.consumeSymbol(TokenType.COLON)) {
                using_expr = sexpr;
            }
            else {
                return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark);
            }
        }

        // Now we are at the optional list of print items.
        let items : PrintItem[] = []
        let separator_required = false;
        let newlineRequired = true;
        while (!scanner.atEos())
        {
            let node: PrintItem = null;

            // Separators are always permitted
            if (scanner.consumeSymbol(TokenType.COMMA)) {
                node = new PrintComma()
                separator_required = false
                newlineRequired = false
            }
            else if (scanner.consumeSymbol(TokenType.SEMI)) {
                node = new PrintSemi()
                separator_required = false
                newlineRequired = false
            }
            else if (separator_required) {
                // Non-separators must not appear consecutively
                return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark);
            }
            else
            {
                // We have a separator so the remaining items are allowed

                // If we parse a non-separator, we'll need a separator next
                // time
                separator_required = true;
                newlineRequired = true;
                if (scanner.consumeBifn("TAB"))
                {
                    // Parse rest of TAB(nexpr)
                    if (!scanner.consumeSymbol(TokenType.PAR)) {
                        return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
                    }

                    const nexpr = NumericExpression.parse(scanner)
                    if (!nexpr || !scanner.consumeSymbol(TokenType.REN)) {
                        return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark);
                    }

                    node = new PrintTab(nexpr);
                }
                else {

                    const nexpr = NumericExpression.parse(scanner)
                    if (nexpr) {
                        node = new PrintN(nexpr);
                    }
                    else {
                        const sexpr = StringExpression.parse(scanner)
                        if (sexpr) {
                            node = new PrintS(sexpr);
                        }
                        else {
                            return <PrintStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark);
                        }
                    }
                }
            }

            items.push(node);
        }

        // We have now reached the end of the print statement. If the last
        // item is not a semi-colon or a comma, we end with a newline.
        if (newlineRequired) items.push(new PrintLine)
        return new PrintStmt(channel, using_expr, items);
    }

    public source() : string {

        const channelText = (this.channel != null) ? '#' + this.channel.source() + ":" : "";
        var formatText = (this.using != null) ? "USING " + this.using.source() + ':' : "";

        let itemsText = "";
        for(const item of this.items) {
            itemsText += item.source();
        }
        return "PRINT " + channelText + formatText + itemsText;
    }

    public static SOC(context: Context, channel: number) {
        const channelNumber = Utility.round(channel)
        context.root().setOutputChannel(<TerminalChannel>context.root().channels.get(channelNumber))
    }

    public static TTB(context: Context) {
        context.root().getOutputChannel().begin()
    }

    public static TTC(context: Context) {
        context.root().getOutputChannel().comma()
    }

    public static TTE(context: Context) {
        context.root().getOutputChannel().end()
    }

    public static TTF(context: Context, format: string) {
        context.root().getOutputChannel().setFormat(format)
    }

    public static TTL(context: Context) {
        context.root().getOutputChannel().wrch("\n")
        context.root().getOutputChannel().eol()
    }

    public static TTN(context: Context, value: number) {
        context.root().getOutputChannel().formatNumber(value)
    }

    public static TTS(context: Context, text: string) {
        context.root().getOutputChannel().text(text)
    }

    public static TTT(context: Context, column: number) {
        // Evaluate the tab setting, rounded down to an integer and
        // converted to a zero-based offset
        const rounded = Utility.round(column)
        context.root().getOutputChannel().tab(rounded - 1);
    }

    public compile(vm: Vm) {

        // Code to calculate the channel number and establish it as the
        // current output channel
        if (this.channel) {
            this.channel.compile(vm)
        }
        else {
            vm.emit([Op.PUSH, 0])
        }
        vm.emit1(Op.SOC)

        // Code to establish any format string
        if (this.using) {
            this.using.compile(vm)
            vm.emit1(Op.TTF)
        }

        vm.emit1(Op.TTB)
        this.items.forEach(item => {
            item.compile(vm)
        })
        vm.emit1(Op.TTE)
    }
}
