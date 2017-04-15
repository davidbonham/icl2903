/// <reference path="../ast.ts" />

abstract class PrintItem {
    public abstract render(channel: TerminalChannel, context: Context) : void
    public abstract source() : string
}

class PrintComma extends PrintItem {

    public source() : string {
        return ",";
    }

    public render(channel: TerminalChannel, context: Context) {
        channel.comma();
    }
}

class PrintSemi extends PrintItem {

    public source() : string {
        return ";";
    }

    public render(channel: TerminalChannel, context: Context) {
        channel.semi();
    }
}

class PrintTab extends PrintItem {

    public constructor(protected readonly tab: NumericExpression) {
        super()
    }

    public source() : string {
        return "TAB(" + this.tab.source() + ")";
    }

    public render(channel: TerminalChannel, context: Context) {
        // Evaluate the tab setting, rounded down to an integer and
        // converted to a zero-based offset
        const column = Math.floor(this.tab.value(context))
        channel.tab(column - 1);
    }
}

class PrintN extends PrintItem {

    public constructor(protected readonly value: NumericExpression){
        super()
    }

    public source() : string {
        return this.value.source();
    }

    public render(channel: TerminalChannel, context: Context) : void {
        channel.formatNumber(this.value.value(context));
    }
}

class PrintS extends PrintItem {

    public constructor(protected readonly value: StringExpression) {
        super()
    }

    public source() : string {
        return this.value.source();
    }

    public render(channel: TerminalChannel, context: Context) {
        channel.text(this.value.value(context));
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
        while (!scanner.atEos())
        {
            let node: PrintItem = null;

            // Separators are always permitted
            if (scanner.consumeSymbol(TokenType.COMMA)) {
                node = new PrintComma();
                separator_required = false;
            }
            else if (scanner.consumeSymbol(TokenType.SEMI)) {
                node = new PrintSemi();
                separator_required = false;
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

        // We have now reached the end of the print statement
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

    public execute(context: Context) : boolean {
        const channel_number = this.channel == null ? 0 : Math.floor(this.channel.value(context) + 0.5)

        const tty = <TerminalChannel>context.owner.channels.get(channel_number);

        tty.begin()

        // Set up the format strings for this print statement, if there are any
        if (this.using != null) {
            var format_string = this.using.value(context);
            tty.setFormat(format_string);
        }

        for (const item of this.items) {
            item.render(tty, context);
        }

        tty.end();
        return true;
    }
}
