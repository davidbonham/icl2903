/// <reference path="scanner.ts" />
/// <reference path="session.ts" />
/// <reference path="terminal.ts" />

abstract class ASTNode {

    protected static fail(scanner: Scanner, code: string, mark: number) : ASTNode {
        //ErrorCode.set(code);
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
        // statement in the sequence.
         /*
        // Because a statement sequence can contain a loop:
        //    10 PRINT "HELLO"!GOTO 10
        // we need to handle keyboard interrupts. For similar reasons, we also need
        // to spot when we should stop executing the sequence because an earlier
        // statement has branched away from it:
        //    10 A=10!IF A < 10 THEN 20!PRINT "OOPS"
        // should not print OOPS. Handling this is a bit of a fudge at the moment
        // and so
        // FIXME: reworking of branching

        if (context._owner._channels.get(0).interrupt()) {
            context._owner.breakIn();
            return false;
        }
        else {
            //Log.log(Log.Level.INFO, "executing " + _statement.source());
            var carryon = this.statement.execute(context);
            if (carryon)
            {
                // Our statement didn't branch, execute the rest of the
                // statements on the line
                // if (_next != null) Log.log(Log.Level.INFO, "rest of sequence is " + _next.source());
                if (this.next != null)
                    carryon = this.next.execute(context);
            }
            return carryon;
        }
        */
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






