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

abstract class StringExpression extends Expression {
    public abstract value(context: Context) : string

    public static parse(scanner:Scanner) : StringExpression {
        return null
    }

}



/*
    protected static double COS(double n)
    {
        return Math.Cos(n);
    }

    protected static double CPI()
    {
        return Math.PI;
    }

    protected static double EPS()
    {
        return Double.Epsilon;
    }

    protected static double EXP (double n)
    {
        return Math.Exp(n);
    }

    protected static double INF()
    {
        return Double.MaxValue;
    }

    protected static double INT(double n)
    {
        return Math.Floor(n);
    }

    protected static double LEN(string s)
    {
        return (double)s.Length;
    }

    protected static double LIN(string s)
    {
        return (double)s.Count(c => c == '\n');
    }

    protected static double LOG(double n)
    {
        return Math.Log(n);
    }

    public static double OCC(string search, string target)
    {
        int location = search.IndexOf(target);
        return location == -1 ? 0.0 : (1.0+ + OCC(search.Substring(location + target.Length), target));
    }

    protected static double POS(string search, string target)
    {
        return (double)position(search, target, 0, 1);
    }

    public static double POS(string search, string target, double occurrence)
    {
        return (double)position(search, target, 0, (int)occurrence);
    }

    protected static int position(string search, string target, int offset, int occurrence)
    {
        // Test for invalid arguments.
        if (occurrence <= 0 || target == "") return 0;

        // See if there's a match
        var location = search.IndexOf(target);
        if (location == -1) return 0;

        if (occurrence == 1)
        {
            // This is the required one. Convert 0-based index to 1-based
            return location + offset + 1;
        }
        else
        {
            // Look for the next one
            var searchFrom = location + target.Length;
            return position(search.Substring(searchFrom), target, offset + searchFrom, occurrence - 1);
        }
    }

    protected static double RND()
    {
        return random.NextDouble();
    }

    protected static double SGN(double n)
    {
        return (double)Math.Sign(n);
    }

    protected static double SIN(double n)
    {
        return Math.Sin(n);
    }

    protected static double CHR(string s)
    {
        if (s.Length == 0) throw new RunTimeError(0, ErrorCode.InvArg);
        int code = Scanner.characterSet.IndexOf(s[0]);
        if (code == -1) throw new RunTimeError(0, ErrorCode.BugCheck);
        return (double)code;
    }

    protected static double SQR(double n)
    {
        if (n < 0.0) throw new RunTimeError(0, ErrorCode.SquareRootNegative);
        return Math.Sqrt(n);
    }

    protected static double TAN(double n)
    {
        return Math.Tan(n);
    }

    protected static double VAL(string s)
    {
        double result;
        if (Double.TryParse(s, out result))
        {
            return result;
        }
        throw new RunTimeError(0, ErrorCode.InvString);
    }
    */



