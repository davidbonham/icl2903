class RandomiseStmt extends Statement
{
    public constructor(protected readonly keyword: string, protected readonly nexpr: NumericExpression) {
        super()
    }

    public source() : string {
        return this.keyword + (this.nexpr == null ? "" : (' ' + this.nexpr.source()));
    }

    public execute(context: Context) : boolean {
        // There is no way to set the seed of the javascript random number
        // generator.
        return true;
    }

    public static parse(scanner: Scanner) : RandomiseStmt {
        scanner.mark();
        if (scanner.consumeKeyword("RANDOMISE") || scanner.consumeKeyword("RANDOMIZE")) {

            // We need to recreate the original keyword in listings
            const keyword = scanner.current().text
            const seed = NumericExpression.parse(scanner)
            return new RandomiseStmt(keyword, seed)
        }
        else
        {
            return null
        }
    }
}
