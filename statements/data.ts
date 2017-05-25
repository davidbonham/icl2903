class DataStmt extends Statement
{
    public isImmediateStatement() : boolean {
        return false;
    }

    protected constructor(protected readonly data: Datum[]) {
        super()
    }

    public static parse(scanner: Scanner) : DataStmt {

        if (!scanner.consumeKeyword("DATA")) return null

        const mark = scanner.mark()
        let items: Datum[] = []
        for (;;) {

            if (scanner.consumeNumber()) {
                items.push(new NDatum(scanner.current().text))
            }
            else if (scanner.consumeString()) {
                items.push(new SDatum(scanner.current().text))
            }
            else if (scanner.consumeUnquoted()) {
                items.push(new UDatum(scanner.current().text))
            }
            else {
                // Can't happen
                return <DataStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
            }

            // No more items unless we have a comma
            if (!scanner.consumeSymbol(TokenType.COMMA)) break;
        }

        // We must have at least one item
        if (items.length > 0) {
            return new DataStmt(items)
        }
        else {
            scanner.restore(mark)
            return null
        }
    }

    public source() : string {
        return "DATA " + this.data.map(datum => datum.source()).join(",")
    }

    public prepare(context: Context, line: number) : void {
        this.data.forEach ((datum) => context.root().data.add(line, datum))
    }
}

abstract class Datum {
    public abstract source() : string
}

class NDatum extends Datum {

    public source() : string {
        return this.text;
    }

    public value() : string {
        return this.text;
    }

    public constructor(protected readonly text: string) {
        super()
    }
}

class SDatum extends Datum
{
    public source() : string {
        return this.data;
    }

    public value() : string {
        return this.data.substring(1, this.data.length-2);
    }

    public constructor(protected readonly data: string) {
        super()
    }
}

class UDatum extends SDatum {

    public value() : string {
        return this.data;
    }


}
