/// <reference path="scanner.ts" />
/// <reference path="session.ts" />
/// <reference path="terminal.ts" />

abstract class ASTNode {

    protected static fail(scanner: Scanner, code: string, mark: number) : ASTNode {
        ErrorCode.set(code)
        if (mark != undefined) scanner.restore(mark);
        return null
    }

}

class LineRangeNode extends ASTNode
{
    public constructor(public readonly from: number, public readonly to: number) {
        super()
    }

    public static parse(scanner: Scanner) : LineRangeNode {

        // We may consume multiple tokens before we discover we must fail
        // so we'll need to leave the scanner undisturbed in that case.
        const start = scanner.mark();

        const first = scanner.consumeLinenumber()
        if (first != undefined) {

            if (scanner.consumeSymbol(TokenType.COMMA)) {
                const last = scanner.consumeLinenumber()
                if (last !== undefined) {
                    // 100,200
                    return new LineRangeNode(first, last);
                }
                else {
                    // 100,
                    return new LineRangeNode(first, Scanner.MAX_LINE);
                }
            }
            else {
                // 100
                return new LineRangeNode(first, first);
            }
        }
        else if (scanner.consumeSymbol(TokenType.COMMA)) {
            const last = scanner.consumeLinenumber()
            if (last !== undefined) {
                // ,200
                return new LineRangeNode(1, last);
            }
            else {
                // , on its own isn't legal
                scanner.restore(start);
                return null;
            }
        }

        return null;
    }
}

abstract class Command extends ASTNode {
    public abstract execute(session: Session.Session) : void
}

abstract class Statement extends ASTNode {

    public abstract source() : string
    public abstract execute(context: Context) : boolean

    public isImmediateStatement() : boolean {
        return true;
    }

    public isIfConsequent() {
        return this.isImmediateStatement();
    }

    // By default, statements have no work to do when they are renumbered.
    // Only statements like GOTO and RESTORE contain line numbers
    public renumber(lineMap: number[]) : void {}

    // By default, there is no preparation to be done for a statement. Only
    // DATA and DIM statements have work to do.
    public prepare(context: Context, line: number) : void {}
}

class SequenceStmt extends Statement
{
    public constructor(public readonly statement: Statement, public readonly next: SequenceStmt) {
        super()
    }

    public  source() : string {
        return this.statement.source() + (this.next != null ? "!" + this.next.source() : "");
    }

    public execute(context: Context) : boolean {

        return this.statement.execute(context)
        // In this implementation, we expect to expand sequence statements
        // into the program contents so we only ever execute the first
        // statement in the sequence. This expansion solves two problems:
        //
        // 1. In FOR I=1 TO 1E20! PRINT I!NEXT I, we poll for interrupts in
        //    the loop
        // 2. In IF 1=1 THEN 50!GOTO 400, we won't execute the GOTO
     }

    public prepare(context: Context, line: number) : void {

        // Similarly, we only prepare the first statement
        this.statement.prepare(context, line)
        /*
        _statement.prepare(context, line);
        if (_next != null)
            _next.prepare(context, line);
            */
    }

    public renumber(lineMap: number[]) : void
    {
        this.statement.renumber(lineMap)
        if (this.next != null) {
            this.next.renumber(lineMap)
        }
    }
}




abstract class Expression extends ASTNode {
    public abstract source() : string;
}






