class DimStmt extends Statement
{
    public isImmediateStatement() : boolean {
        return false
    }


    private constructor(protected readonly items: DimItem[]) {
        super()
    }

    public static parse(scanner: Scanner) : DimStmt {

        if (!scanner.consumeKeyword("DIM")) {
            // This isn't a DIM statement, let another parser have a go
            return null;
        }

        // Because the parse may fail at a nid or sid which are legal first
        // symbols for other productions, we must reset on failure.
        const mark = scanner.mark()

        let items : DimItem[] = []
        for (;;)
        {
            const item = DimItem.parseDimItem(scanner)
            if (item) {
                items.push(item)
            }
            else {
                scanner.restore(mark);
                return null
            }

            // If we can consume a comma, we must be followed by another
            // item else we must be done
            if (!scanner.consumeSymbol(TokenType.COMMA)) break;
        }

        // We must have at least one item by the nature of the above loop
        return new DimStmt(items)
    }

    public source() : string {
        return "DIM " + this.items.map(item => item.source()).join(",")
    }

    public execute(context: Context) : boolean {
        return true;
    }

    public prepare(context: Context, line: number) : void
    {
        for (const item of this.items) {
            item.prepare(context)
        }
    }
}


class DimItem {

    public constructor(protected readonly ref: NRef | SRef) {
    }

    public static parseDimItem(scanner: Scanner) : DimItem {

        let nref: NRef
        let sref: SRef

        if ((nref = NRef.parse(scanner)) && nref.hasConstantSubscripts()) {
            return new DimItem(nref)
        }
        else if ((sref = SRef.parse(scanner)) && sref.hasConstantSubscripts()) {
            return new DimItem(sref)
        }

        return null
    }

    public source() : string {
        return this.ref.source()
    }

    public prepare(context: Context) : void {
        if (this.ref instanceof NRef) {
            this.ref.prepare(context)
        }
        else {
            this.ref.prepare(context)
        }
    }
}

