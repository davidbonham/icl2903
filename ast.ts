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

// ? - Display the full text of the last error message
//
// Some error messages are reported by error number only - I imagine this
// was because the overlay in which they were contained (the command processing
// perhaps) did not have room for the full text. The ? command displays the
// full text corresponding to the error number.
//
// Because the last error is state of the session, this command is never
// executed. Instead the session spots the result of the parse and handles
// it itself.
class QuestionCmd extends Command {
    public  execute(session: Session.Session) : void {}
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



abstract class NumericExpression extends Expression {

    // The largest number ICL2903 BASIC allowed
    public static readonly MAXIMUM = 5.7e75;

    public isConstant() : boolean {
        return this instanceof NLiteral
    }

    public abstract value(context: Context) : number

    public static parse(scanner: Scanner) : NumericExpression {
        return ExpressionParser.parse(scanner, 0)
    }
}
/*
        protected class FofX : NFunction
        {
            protected string _name;
            protected FofX_Imp _imp;

            public FofX(string name, FofX_Imp imp)
            {
                _name = name;
                _imp = imp;
            }

            public override double value(Context context)
            {
                return _imp();
            }

            public override string source()
            {
                return _name;
            }

            public static bool parse(Scanner scanner, string name, FofX_Imp imp, out NFunction tree)
            {
                tree = new FofX(name, imp);
                return true;
            }
        }


        protected class FofS : NFunction
        {
            protected string _name;
            protected StringExpression _op;
            protected FofS_Imp _imp;

            public FofS(string name, FofS_Imp imp, StringExpression op)
            {
                _name = name;
                _imp = imp;
                _op = op;
            }

            public override double value(Context context)
            {
                string op = _op.value(context);
                var value = _imp(op);
                if (value < -MAXIMUM || MAXIMUM < value) throw new RunTimeError(0, ErrorCode.OverflowOrUnassigned);
                return value;
            }

            public override string source()
            {
                return _name + '(' + _op.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofS_Imp imp, out NFunction tree)
            {
                StringExpression op;
                if (scanner.consume_symbol(Scanner.TokenType.PAR) && StringExpression.parse(scanner, out op) && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofS(name, imp, op);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSS : NFunction
        {
            protected string _name;
            protected StringExpression _op1;
            protected StringExpression _op2;
            protected FofSS_Imp _imp;

            public FofSS(string name, FofSS_Imp imp, StringExpression op1, StringExpression op2)
            {
                _name = name;
                _imp = imp;
                _op1 = op1;
                _op2 = op2;
            }

            public override double value(Context context)
            {
                string op1 = _op1.value(context);
                string op2 = _op2.value(context);
                return _imp(op1, op2);
            }

            public override string source()
            {
                return _name + '(' + _op1.source() + ',' + _op2.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSS_Imp imp, out NFunction tree)
            {
                StringExpression op1;
                StringExpression op2;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                &&  StringExpression.parse(scanner, out op1)
                &&  scanner.consume_symbol(Scanner.TokenType.COMMA)
                &&  StringExpression.parse(scanner, out op2)
                &&  scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSS(name, imp, op1, op2);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSSN : NFunction
        {
            protected string _name;
            protected StringExpression _op1;
            protected StringExpression _op2;
            protected NumericExpression _op3;
            protected FofSSN_Imp _imp;

            public FofSSN(string name, FofSSN_Imp imp, StringExpression op1, StringExpression op2, NumericExpression op3)
            {
                _name = name;
                _imp = imp;
                _op1 = op1;
                _op2 = op2;
                _op3 = op3;
            }

            public override double value(Context context)
            {
                string op1 = _op1.value(context);
                string op2 = _op2.value(context);
                double op3 = _op3.value(context);
                return _imp(op1, op2, op3);
            }

            public override string source()
            {
                return _name + '(' + _op1.source() + ',' + _op2.source() + ',' + _op3.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSSN_Imp imp, out NFunction tree)
            {
                StringExpression  op1;
                StringExpression  op2;
                NumericExpression op3;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                && StringExpression.parse(scanner, out op1)
                && scanner.consume_symbol(Scanner.TokenType.COMMA)
                && StringExpression.parse(scanner, out op2)
                && scanner.consume_symbol(Scanner.TokenType.COMMA)
                && NumericExpression.parse(scanner, out op3)
                && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSSN(name, imp, op1, op2, op3);
                    return true;
                }

                tree = null;
                return false;
            }
        }
        */

class ExpressionParser {

    private static isBinaryOperator(scanner: Scanner) : boolean {
        return scanner.consumeSymbol(TokenType.ADD)
            || scanner.consumeSymbol(TokenType.SUB)
            || scanner.consumeSymbol(TokenType.MUL)
            || scanner.consumeSymbol(TokenType.DIV)
            || scanner.consumeSymbol(TokenType.POW1)
            || scanner.consumeSymbol(TokenType.POW2)
            || scanner.consumeKeyword("MIN")
            || scanner.consumeKeyword("MAX")
    }

    private static precedence(token : Token) :  number {
        switch (token.type) {
            case TokenType.KEY:
                return 1;
            case TokenType.ADD:
            case TokenType.SUB:
                return 2;
            // Unary minus has precedence 3
            case TokenType.MUL:
            case TokenType.DIV:
                return 4;
            case TokenType.POW1:
            case TokenType.POW2:
                return 5;
            default:
                return 0;
        }
    }

    private static isRightAssociative(token: Token) : boolean {
        return token.type == TokenType.POW1 || token.type == TokenType.POW2;
    }

    private static expression(scanner: Scanner, callerPrecedence: number) : NumericExpression
    {
        let lhs = ExpressionParser.primary(scanner)
        if (lhs) {
            for (;;) {
                // Is there another part of this expression - it will be a
                // binary operator - either a symbol or a keyword.
                const pos = scanner.mark();
                if (!ExpressionParser.isBinaryOperator(scanner)) return lhs;

                // If it's of lower precedence, we have finished this
                // subexpression, so don't consume this token
                const next : Token = scanner.current()
                var nextPrecedence = ExpressionParser.precedence(next)
                if (nextPrecedence < callerPrecedence) {
                    scanner.restore(pos)
                    return lhs
                }

                // Deal with associativity by tweaking precedence
                if (!ExpressionParser.isRightAssociative(next)) nextPrecedence += 1;

                // We must parse a RHS
                const rhs = ExpressionParser.expression(scanner, nextPrecedence)
                if (!rhs) return null

                lhs = new NBinOp(next, lhs, rhs);
            }
        }
        else {
            return null
        }
    }

    protected static primary(scanner: Scanner) : NumericExpression {

        return NLiteral.parseLiteral(scanner)
               ||   Negate.parseNegate(scanner)
               ||   NBracket.parse(scanner)
           //    ||   NRef.parse(scanner)
               ||   NFunction.parse(scanner)
    }

    public static parse(scanner: Scanner, precedence: number) : NumericExpression {
        return ExpressionParser.expression(scanner, precedence);
    }
}


class NLiteral extends NumericExpression {

    protected _value: number

    public constructor(protected readonly text: string) {
        super()

        // As the text got through the scanner, we know it a legel number
        this._value = + text
    }

    public source(): string {
        return this.text;
    }

    public value(context: Context): number {
        if (this._value < -NumericExpression.MAXIMUM || NumericExpression.MAXIMUM < this._value) {
            throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned);
        }
        return this._value;
    }

    public static parseLiteral(scanner: Scanner) : NumericExpression {

        const value = scanner.consumeNumber();
        if (value == null) {
            return <NumericExpression>this.fail(scanner, ErrorCode.StatementNotRecognised, null)
        }

        return new NLiteral(value);
    }
}

class Negate extends NumericExpression {

    public constructor(protected readonly nexpr: NumericExpression) {
        super()
    }

    public source() : string {
        return '-' + this.nexpr.source();
    }

    public value(context: Context): number  {
        return - this.nexpr.value(context);
    }

    public static parseNegate(scanner: Scanner) : NumericExpression {

        if (scanner.consumeSymbol(TokenType.SUB)) {
            const subexpression = ExpressionParser.parse(scanner, 3)
            if (subexpression) return new Negate(subexpression)
        }
        return null
    }
}

abstract class NFunction extends NumericExpression {

    public static ABS(n : number) : number {
        return Math.abs(n);
    }

    public static ATN(n: number) : number {
        return Math.atan(n);
    }

    public static parse(scanner: Scanner) : NumericExpression  {

        const start_mark = scanner.mark();

        if (scanner.consumeBifn("ABS"))
            return FofN.parseFofN(scanner, "ABS", NFunction.ABS)

            /*
        else if (scanner.consume_bifn("ATN"))
            result = FofN.parse(scanner, "ATN", new FofN_Imp(ATN), out nfunc);
        else if (scanner.consume_bifn("COS"))
            result = FofN.parse(scanner, "COS", new FofN_Imp(COS), out nfunc);
        else if (scanner.consume_bifn("CHR"))
            result = FofS.parse(scanner, "CHR", new FofS_Imp(CHR), out nfunc);
        else if (scanner.consume_bifn("CPI"))
            result = FofX.parse(scanner, "CPI", new FofX_Imp(CPI), out nfunc);
        else if (scanner.consume_bifn("EPS"))
            result = FofX.parse(scanner, "EPS", new FofX_Imp(EPS), out nfunc);
        else if (scanner.consume_bifn("EXP"))
            result = FofN.parse(scanner, "EXP", new FofN_Imp(EXP), out nfunc);
        else if (scanner.consume_bifn("INF"))
            result = FofX.parse(scanner, "INF", new FofX_Imp(INF), out nfunc);
        else if (scanner.consume_bifn("INT"))
            result = FofN.parse(scanner, "INT", new FofN_Imp(INT), out nfunc);
        else if (scanner.consume_bifn("LEN"))
            result = FofS.parse(scanner, "LEN", new FofS_Imp(LEN), out nfunc);
        else if (scanner.consume_bifn("LIN"))
            result = FofS.parse(scanner, "LIN", new FofS_Imp(LIN), out nfunc);
        else if (scanner.consume_bifn("LOG"))
            result = FofN.parse(scanner, "LOG", new FofN_Imp(LOG), out nfunc);
        else if (scanner.consume_bifn("OCC"))
            result = FofSS.parse(scanner, "OCC", new FofSS_Imp(OCC), out nfunc);
        else if (scanner.consume_bifn("POS"))
        {
            var mark = scanner.mark();
            result = FofSS.parse(scanner, "POS", new FofSS_Imp(POS), out nfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSN.parse(scanner, "POS", new FofSSN_Imp(POS), out nfunc);
            }
        }
        else if (scanner.consume_bifn("RND"))
            result = FofX.parse(scanner, "RND", new FofX_Imp(RND), out nfunc);
        else if (scanner.consume_bifn("SGN"))
            result = FofN.parse(scanner, "SGN", new FofN_Imp(SGN), out nfunc);
        else if (scanner.consume_bifn("SIN"))
            result = FofN.parse(scanner, "SIN", new FofN_Imp(SIN), out nfunc);
        else if (scanner.consume_bifn("SQR"))
            result = FofN.parse(scanner, "SQR", new FofN_Imp(SQR), out nfunc);
        else if (scanner.consume_bifn("TAN"))
            result = FofN.parse(scanner, "TAN", new FofN_Imp(TAN), out nfunc);
        else if (scanner.consume_bifn("VAL"))
            result = FofS.parse(scanner, "VAL", new FofS_Imp(VAL), out nfunc);
        */
        scanner.restore(start_mark)
        return null
    }

}

class FofN extends NFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (n: number) => number,
                       protected readonly operand: NumericExpression) {
        super()
     }

    public value(context: Context) : number {

        // Evaluate the operand
        const value = this.operand.value(context)

        // Apply out function to it
        const result = this.func(value)

        // Check we're still in range on ICL2903 BASIC
        if (result < -NumericExpression.MAXIMUM || NumericExpression.MAXIMUM < result) {
            throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)
        }

        return value
    }

    public source() : string {
        return this.name + '(' + this.operand.source() + ')';
    }

    public static parseFofN(scanner: Scanner, name: string, func: (b: number) => number) : NFunction {
        if (scanner.consumeSymbol(TokenType.PAR)) {
            const operand = NumericExpression.parse(scanner)
            if (operand && scanner.consumeSymbol(TokenType.REN)) {
                return new FofN(name, func, operand);
            }
        }
        return null
   }
}

class NBracket extends NumericExpression {

    public constructor(protected readonly nexpr: NumericExpression) {
        super()
    }

    public source() : string {
        return '(' + this.nexpr.source() + ')';
    }

    public value(context: Context) : number {
        return this.nexpr.value(context);
    }

    public static parse(scanner: Scanner) : NumericExpression {
        if (scanner.consumeSymbol(TokenType.PAR)) {
            const expr = ExpressionParser.parse(scanner, 0)
            if (expr && scanner.consumeSymbol(TokenType.REN)) {
                return new NBracket(expr)
            }
        }
        return null
    }
}

class NBinOp extends NumericExpression {

    public constructor(protected readonly op: Token,
                       protected readonly lhs: NumericExpression,
                       protected readonly rhs: NumericExpression) {
        super()
    }

    public source() : string {
        const text = this.op.text[0] == 'M' ? (' ' + this.op.text + ' ') : this.op.text;
        return this.lhs.source() + text + this.rhs.source()
    }

    public value(context: Context) : number {
        const lv = this.lhs.value(context)
        const rv = this.rhs.value(context)

        let result: number
        switch (this.op.type)
        {
            case TokenType.KEY:
                if (this.op.text == "MIN") {
                    result = Math.min(lv, rv);
                }
                else if (this.op.text == "MAX") {
                    result = Math.max(lv, rv);
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.BugCheck);
                }
                break;
            case TokenType.ADD:
                result = lv + rv;
                break;
            case TokenType.SUB:
                result = lv - rv;
                break;
            case TokenType.MUL:
                result = lv * rv;
                break;
            case TokenType.DIV:
                result = lv / rv;
                break;
            case TokenType.POW1:
            case TokenType.POW2:
                result = Math.pow(lv, rv);
                break;
            default:
                throw new Utility.RunTimeError(ErrorCode.BugCheck);
        }

        if (Number.isNaN(result)
        ||  !Number.isFinite(result)
        ||  result < -NumericExpression.MAXIMUM
        ||  NumericExpression.MAXIMUM < result) {
            throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)
        }

        return result;
    }
}

/*
abstract class NRef extends NumericExpression
{
    abstract public void set(Context context, double value);
    abstract public bool hasConstantSubscripts();
    virtual public void prepare(Context context)
    {
    }
    public static bool parse(Scanner scanner, out NRef tree)
    {
        if (!scanner.consume_nid())
        {
            tree = null;
            return false;
        }

        string nid = scanner.current()._text;

        // If we don't have a ( or [, this can only be a scalar
        if (!scanner.consume_symbol(Scanner.TokenType.PAR) && !scanner.consume_symbol(Scanner.TokenType.BRA))
        {
            tree = new NScalarRef(nid);
            return true;
        }

        // Having read a ( or [, the NRef production is no longer an
        // optional parse - we must complete it or fail with a syntax
        // error. From now on, we can't return false. It's a vector or
        // an array so we must have at least one subscript.
        NumericExpression col_expr;
        if (!NumericExpression.parse(scanner, out col_expr))
        {
            tree = null;
            return false;
        }

        // Now we must have either a comma, indicating this is an array
        // rather than a vector, or a ) or ], indicating this as a
        // vector.
        if (scanner.consume_symbol(Scanner.TokenType.REN) || scanner.consume_symbol(Scanner.TokenType.KET))
        {
            tree = new NVectorRef(nid, col_expr);
            return true;
        }

        // Having read a ( or [, the NRef production is no longer an
        // optional parse - we must complete it or fail with a syntax
        // error. From now on, we can't return false.
        if (!scanner.consume_symbol(Scanner.TokenType.COMMA))
        {
            tree = null;
            return false;
        }

        NumericExpression row_expr;
        if (!NumericExpression.parse(scanner, out row_expr))
        {
            tree = null;
            return false;
        }

        if (!scanner.consume_symbol(Scanner.TokenType.REN) && !scanner.consume_symbol(Scanner.TokenType.KET))
        {
            tree = null;
            return false;
        }

        tree = new NArrayRef(nid, col_expr, row_expr);
        return true;
    }
}

class NScalarRef : NRef
{
    public string _name;

    public NScalarRef(string name)
    {
        _name = name;
    }
    override public double value(Context context)
    {
        return context.getDouble(_name);
    }
    override public string source()
    {
        return _name;
    }
    override public void set(Context context, double value)
    {
        context.set(_name, value);
    }

    public bool same(NScalarRef other)
    {
        return _name == other._name;
    }

    override public bool hasConstantSubscripts()
    {
        return false;
    }
}

class NVectorRef : NRef
{
    string _name;
    NumericExpression _col;
    public NVectorRef(string name, NumericExpression col_expr)
    {
        _name = name;
        _col = col_expr;
    }
    override public double value(Context context)
    {
        return context.getDouble(_name, _col.value(context));
    }
    override public string source()
    {
        return _name + '[' + _col.source() + ']';
    }
    override public void set(Context context, double value)
    {
        context.set(_name, _col.value(context), value);
    }
    public override bool hasConstantSubscripts()
    {
        return _col.isConstant();
    }
    public override void prepare(Context context)
    {
        context.dimDouble(_name, _col.value(context));
    }
}

class NArrayRef : NRef
{
    string _name;
    NumericExpression _col;
    NumericExpression _row;

    public NArrayRef(string name, NumericExpression col_expr, NumericExpression row_expr)
    {
        _name = name;
        _col = col_expr;
        _row = row_expr;
    }
    override public double value(Context context)
    {
        return context.getDouble(_name, _col.value(context), _row.value(context));
    }
    override public string source()
    {
        return _name + '[' + _col.source() + ',' + _row.source() + ']';
    }
    override public void set(Context context, double value)
    {
        context.set(_name, _col.value(context), _row.value(context), value);
    }
    public override bool hasConstantSubscripts()
    {
        return _col.isConstant() && _row.isConstant();
    }
    public override void prepare(Context context)
    {
        context.dimDouble(_name, _col.value(context), _row.value(context));
    }
*/

