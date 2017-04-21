/// <reference path="../logicalexpression.ts" />

class IfStmt extends Statement {

    public source() : string {
        return "IF " + this.condition.source() + ' ' + (this.then ? "THEN " : "") + this.consequence.source()
    }

    public execute(context: Context) : boolean {
        return this.condition.value(context) ? this.consequence.execute(context) : true
    }

    public renumber(lineMap: number[]) : void {
        this.consequence.renumber(lineMap)
    }

    public constructor(protected readonly condition: LogicalExpression,
                       protected readonly then: boolean,
                       protected readonly consequence: Statement) {
        super()
    }

    public static parse(scanner: Scanner) : IfStmt {

        // On any parsing error, always restore to the start of the
        // statement to avoid leaving tokens that might legally parse as
        // another statement eg IF GOTO 40. So mark that point immediately:
        const mark = scanner.mark()

        if (scanner.consumeKeyword("IF"))
        {
            let condition: LogicalExpression
            let consequence: Statement

            // We are definitely parsing an IF statement
            if ((condition = LogicalExpression.parse(scanner))) {

                // THEN is optional but permits the next token to be a line
                // number
                const then = scanner.consumeKeyword("THEN")
                if ((consequence = IfStmt.parseConsequence(scanner, then))) {
                    // Successful parse so return the tree and indicate success.
                    return new IfStmt(condition, then, consequence)
                }
            }

            // We failed the parse but we should have been an IF. Note
            // the syntax error and restore the scanner to the IF to
            // stop any later parser succeeding by accident.
            return <IfStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }
        else  {
            // We didn't see an IF so this isn't an IF statement. Leave
            // things as they are and let the next parser have a go.
            return null
        }
    }

    protected static parseConsequence(scanner: Scanner, then: boolean) : Statement
    {
        // We now have a choice:
        // IF condition THEN line-number
        // IF condition THEN if-consequence-statement
        // IF condition if-consequence-statement
        if (then)
        {
            const line = scanner.consumeLinenumber()
            if (line) {
                // IF condition THEN line-number
                return new Then(line)
            }
            else {
                return IfStmt.parseIfConsequenceStatement(scanner);
            }
        }
        else {
            return IfStmt.parseIfConsequenceStatement(scanner);
        }
    }

    protected static parseIfConsequenceStatement(scanner: Scanner) : Statement  {

        const mark = scanner.mark()
        const consequence = BasicParser.parseStatement(scanner)
        if (consequence.isIfConsequent()) {
                return consequence
        }

        // This is a valid statement but it may not follow an IF
        return <Statement>this.fail(scanner, ErrorCode.NotIf, mark)
    }
}
