/// <reference path="ast.ts" />

abstract class StringExpression extends Expression {

    protected static primary(scanner: Scanner) : StringExpression {

        return SLiteral.parseLiteral(scanner)
        ||     SBracket.parseBracket(scanner)
        ||     SFunction.parseFunction(scanner)
        //||     SRef.parse(scanner)

         //if (NFunction(scanner, out tree)) return tree;
        //if (NUDF(scanner, out tree)) return tree;
   }

    public static parse(scanner: Scanner) : StringExpression {

        let lhs = StringExpression.primary(scanner)
        if (lhs) {
            while (scanner.consumeSymbol(TokenType.CAT)) {
                const rhs = StringExpression.primary(scanner)
                if (rhs) {
                    lhs = new SCatOp(lhs, rhs)
                }
                else {
                    return null;
                }
            }
        }
        return lhs
    }

    public abstract source() : string

    public abstract value(context: Context) : string
}

abstract class SFunction extends StringExpression
{
    protected static CHR(n: number) : string {
        if (n < 0 || 63 < n) throw new Utility.RunTimeError(ErrorCode.InvArg);
        return Scanner.characterSet[n]
    }
    protected static DAT() : string {
        return Utility.basicDate(new Date)
    }

    protected static DEL(s1: string, s2: string, n: number = 1) : string {
        // Get pos and convert to index by subtracting one
        const index = NFunction.POS(s1, s2, n) - 1;
        return (index < 0) ? s1 : (s1.slice(0, index) + s1.slice(index + s2.length))
    }

    protected static GAP(n : number) : string {
        return SFunction.MUL(' ', n)
    }

    protected static LIN(n: number) : string {
        return SFunction.MUL('\n', n)
    }

    protected static MUL(s: string, n: number) : string
    {
        if (n < 0 || 9999 < n) throw new Utility.RunTimeError(ErrorCode.InvArg);
        return s.repeat(n)
    }

    protected static REP(s1: string, s2: string, s3: string, n: number = 1) : string {

        if (n < 0 || 99999 < n) throw new Utility.RunTimeError(ErrorCode.InvArg)
        const index = NFunction.POS(s1, s2, n) - 1

        if (index < 0) return s1

        return s1.slice(0, index) + s3 + s1.slice(index + s2.length)
    }


    protected static SDL(s1: string, s2: string, n: number = 0) : string {

        if (n < 0 || 9999 < n) throw new Utility.RunTimeError(ErrorCode.InvArg)
        if (s2 == "") return s1

        const occurrances = NFunction.OCC(s1, s2)
        let todo = n == 0 || n > occurrances ? occurrances : n

        let result = s1;
        while (todo > 0) {
            result = SFunction.DEL(result, s2);
            todo -= 1;
        }
        return result;
    }

    protected static SEG1(s: string, n1: number) : string {
        if (n1 < 1 || 9999 < n1) throw new Utility.RunTimeError(ErrorCode.InvArg)
        if (n1 > s.length) return ""
        return s.substring(n1-1)
    }

    protected static SEG2(s: string, n1: number, n2: number) : string {
        if (n1 < 1 || 9999 < n1) throw new Utility.RunTimeError(ErrorCode.InvArg);
        if (n2 < 1 || 9999 < n2) throw new Utility.RunTimeError(ErrorCode.InvArg);
        if (n2 < n1) return "";

        if (n1 > s.length || n2 < n1) return "";
        if (n2 > s.length) n2 = s.length;

        return s.substring(n1-1, n2 - n1 + 1)
    }

    protected static SGN(n: number) : string {
        return n < 0 ? "-" : n == 0 ? " " : "+";
    }

    protected static SRP(s1: string, s2: string, s3: string, n: number = 0) : string {

        // Clip n to the largest possible value
        let count = n == 0.0 ? s1.length : n > s1.length ? s1.length : n

        let newstring = s1;
        while (count > 0) {
            const oldstring = newstring
            newstring = SFunction.REP(newstring, s2, s3)
            if (newstring == oldstring) break
            --count
        }
        return newstring
    }

    protected static SUB1(s1: string, n: number) : string {
        if (n < 0 || s1.length - 1 < n) throw new Utility.RunTimeError(ErrorCode.InvArg)
        return s1[n-1]
    }

    protected static SUB2(s1: string, n1: number, n2: number) : string {
        if (n1 < 0 || s1.length - 1 < n1) throw new Utility.RunTimeError(ErrorCode.InvArg)
        if (n2 < 0 || s1.length - 1 < n2) throw new Utility.RunTimeError(ErrorCode.InvArg)
        return s1.substring(n1 - 1, n2)
    }

    protected static STR(n: number) : string {
        return BIF.str$.call(n);
    }

    protected static TIM() : string {
        return Utility.basicTime(new Date)
    }

    public static parseFunction(scanner: Scanner) : StringExpression {

        const start_mark = scanner.mark()
        let result : SFunction = null

        if (scanner.consumeBifs("CHR$"))
            result = FofN$.parseFofN(scanner, "CHR$", SFunction.CHR)
            /*
        else if (scanner.consumeBifs("DAT$"))
            result = FofX.parse(scanner, "DAT$", new FofX_Imp(DAT), out sfunc);
        else if (scanner.consume_bifs("DEL$"))
        {
            var mark = scanner.mark();
            result = FofSS.parse(scanner, "DELS", new FofSS_Imp(DEL), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSN.parse(scanner, "DEL$", new FofSSN_Imp(DEL), out sfunc);
            }
        }
        else if (scanner.consume_bifs("DEL$"))
            result = FofSS.parse(scanner, "DEL$", new FofSS_Imp(DEL), out sfunc);
        else if (scanner.consume_bifs("GAP$"))
            result = FofN.parse(scanner, "GAP$", new FofN_Imp(GAP), out sfunc);
        else if (scanner.consume_bifs("LIN$"))
            result = FofN.parse(scanner, "LIN$", new FofN_Imp(LIN), out sfunc);
        else if (scanner.consume_bifs("MUL$"))
            result = FofSN.parse(scanner, "MUL$", new FofSN_Imp(MUL), out sfunc);
        else if (scanner.consume_bifs("REP$"))
        {
            var mark = scanner.mark();
            result = FofSSS.parse(scanner, "REP$", new FofSSS_Imp(REP), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSSN.parse(scanner, "REP$", new FofSSSN_Imp(REP), out sfunc);
            }
        }
        else if (scanner.consume_bifs("SDL$"))
        {
            var mark = scanner.mark();
            result = FofSS.parse(scanner, "SDL$", new FofSS_Imp(SDL), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSN.parse(scanner, "SDL$", new FofSSN_Imp(SDL), out sfunc);
            }
        }
        else if (scanner.consume_bifs("SEG$"))
        {
            var mark = scanner.mark();
            result = FofSN.parse(scanner, "SEG$", new FofSN_Imp(SEG), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSNN.parse(scanner, "SEG$", new FofSNN_Imp(SEG), out sfunc);
            }
        }
        else if (scanner.consume_bifs("SGN$"))
            result = FofN.parse(scanner, "SGN$", new FofN_Imp(SGN), out sfunc);
        else if (scanner.consume_bifs("SRP$"))
        {
            var mark = scanner.mark();
            result = FofSSS.parse(scanner, "SRP$", new FofSSS_Imp(SRP), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSSN.parse(scanner, "SRP$", new FofSSSN_Imp(SRP), out sfunc);
            }
        }
        else if (scanner.consume_bifs("STR$"))
            result = FofN.parse(scanner, "STR$", new FofN_Imp(STR), out sfunc);
        else if (scanner.consume_bifs("SUB$"))
        {
            var mark = scanner.mark();
            result = FofSN.parse(scanner, "SUB$", new FofSN_Imp(SUB), out sfunc);
            if (!result)
            {
                scanner.restore(mark);
                result = FofSNN.parse(scanner, "SUB$", new FofSNN_Imp(SUB), out sfunc);
            }
        }
        else if (scanner.consumeBifs("TIM$"))
            result = FofX.parse(scanner, "TIM$", new FofX_Imp(TIM), out sfunc);
*/
        if (result == null) scanner.restore(start_mark);
        return result
    }
}

class FofN$ extends SFunction
{
    public constructor(protected readonly name: string,
                       protected readonly func: (n:number) => string,
                       protected readonly op: NumericExpression) {
        super()
    }

    public value(context: Context) : string {
        const op = this.op.value(context)
        return this.func(op)
    }

    public source() : string {
        return this.name + '(' + this.op.source() + ')'
    }

    public static parseFofN(scanner: Scanner, name: string, func: (n:number) => string) : FofN$ {

        let op: NumericExpression
        if (scanner.consumeSymbol(TokenType.PAR)
        && (op = NumericExpression.parse(scanner))
        && scanner.consumeSymbol(TokenType.REN)) {
            return new FofN$(name, func, op)
        }

        return null
    }
}

/*
        protected class FofSS : SFunction
        {
            protected string _name;
            protected StringExpression _s1;
            protected StringExpression _s2;
            protected FofSS_Imp _imp;

            public FofSS(string name, FofSS_Imp imp, StringExpression s1, StringExpression s2)
            {
                _name = name;
                _imp = imp;
                _s1 = s1;
                _s2 = s2;
            }

            public override string value(Context context)
            {
                string s1 = _s1.value(context);
                string s2 = _s2.value(context);
                return _imp(s1, s2);
            }

            public override string source()
            {
                return _name + '(' + _s1.source() + ',' + _s2.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSS_Imp imp, out SFunction tree)
            {
                StringExpression s1;
                StringExpression s2;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s1)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s2)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSS(name, imp, s1, s2);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSSS : SFunction
        {
            protected string _name;
            protected StringExpression _s1;
            protected StringExpression _s2;
            protected StringExpression _s3;
            protected FofSSS_Imp _imp;

            public FofSSS(string name, FofSSS_Imp imp, StringExpression s1, StringExpression s2, StringExpression s3)
            {
                _name = name;
                _imp = imp;
                _s1 = s1;
                _s2 = s2;
                _s3 = s3;
            }

            public override string value(Context context)
            {
                string s1 = _s1.value(context);
                string s2 = _s2.value(context);
                string s3 = _s3.value(context);
                return _imp(s1, s2, s3);
            }

            public override string source()
            {
                return _name + '(' + _s1.source() + ',' + _s2.source() + ',' + _s3.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSSS_Imp imp, out SFunction tree)
            {
                StringExpression s1;
                StringExpression s2;
                StringExpression s3;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s1)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s2)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s3)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSSS(name, imp, s1, s2, s3);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSSN : SFunction
        {
            protected string _name;
            protected StringExpression _s1;
            protected StringExpression _s2;
            protected NumericExpression _n;
            protected FofSSN_Imp _imp;

            public FofSSN(string name, FofSSN_Imp imp, StringExpression s1, StringExpression s2, NumericExpression n)
            {
                _name = name;
                _imp = imp;
                _s1 = s1;
                _s2 = s2;
                _n = n;
            }

            public override string value(Context context)
            {
                string s1 = _s1.value(context);
                string s2 = _s2.value(context);
                double n = _n.value(context);
                return _imp(s1, s2, n);
            }

            public override string source()
            {
                return _name + '(' + _s1.source() + ',' + _s2.source() + ',' + _n.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSSN_Imp imp, out SFunction tree)
            {
                StringExpression s1;
                StringExpression s2;
                NumericExpression n;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s1)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s2)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && NumericExpression.parse(scanner, out n)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSSN(name, imp, s1, s2, n);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSSSN : SFunction
        {
            protected string _name;
            protected StringExpression _s1;
            protected StringExpression _s2;
            protected StringExpression _s3;
            protected NumericExpression _n;
            protected FofSSSN_Imp _imp;

            public FofSSSN(string name, FofSSSN_Imp imp, StringExpression s1, StringExpression s2, StringExpression s3, NumericExpression n)
            {
                _name = name;
                _imp = imp;
                _s1 = s1;
                _s2 = s2;
                _s3 = s3;
                _n = n;
            }

            public override string value(Context context)
            {
                string s1 = _s1.value(context);
                string s2 = _s2.value(context);
                string s3 = _s3.value(context);
                double n = _n.value(context);
                return _imp(s1, s2, s3, n);
            }

            public override string source()
            {
                return _name + '(' + _s1.source() + ',' + _s2.source() + ',' + _s3.source() + ',' + _n.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSSSN_Imp imp, out SFunction tree)
            {
                StringExpression s1;
                StringExpression s2;
                StringExpression s3;
                NumericExpression n;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s1)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s2)
                && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && StringExpression.parse(scanner, out s3)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && NumericExpression.parse(scanner, out n)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSSSN(name, imp, s1, s2, s3, n);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSN : SFunction
        {
            protected string _name;
            protected StringExpression _s;
            protected NumericExpression _n;
            protected FofSN_Imp _imp;

            public FofSN(string name, FofSN_Imp imp, StringExpression s, NumericExpression n)
            {
                _name = name;
                _imp = imp;
                _s = s;
                _n = n;
            }

            public override string value(Context context)
            {
                string s = _s.value(context);
                double n = _n.value(context);
                return _imp(s, n);
            }

            public override string source()
            {
                return _name + '(' + _s.source() + ',' + _n.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSN_Imp imp, out SFunction tree)
            {
                StringExpression s;
                NumericExpression n;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && NumericExpression.parse(scanner, out n)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSN(name, imp, s, n);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofSNN : SFunction
        {
            protected string _name;
            protected StringExpression _s;
            protected NumericExpression _n1;
            protected NumericExpression _n2;
            protected FofSNN_Imp _imp;

            public FofSNN(string name, FofSNN_Imp imp, StringExpression s, NumericExpression n1, NumericExpression n2)
            {
                _name = name;
                _imp = imp;
                _s = s;
                _n1 = n1;
                _n2 = n2;
            }

            public override string value(Context context)
            {
                string s = _s.value(context);
                double n1 = _n1.value(context);
                double n2 = _n2.value(context);
                return _imp(s, n1, n2);
            }

            public override string source()
            {
                return _name + '(' + _s.source() + ',' + _n1.source() + ',' + _n2.source() + ')';
            }

            public static bool parse(Scanner scanner, string name, FofSNN_Imp imp, out SFunction tree)
            {
                StringExpression s;
                NumericExpression n1, n2;
                if (scanner.consume_symbol(Scanner.TokenType.PAR)
                    && StringExpression.parse(scanner, out s)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && NumericExpression.parse(scanner, out n1)
                    && scanner.consume_symbol(Scanner.TokenType.COMMA)
                    && NumericExpression.parse(scanner, out n2)
                    && scanner.consume_symbol(Scanner.TokenType.REN))
                {
                    tree = new FofSNN(name, imp, s, n1, n2);
                    return true;
                }

                tree = null;
                return false;
            }
        }

        protected class FofX : SFunction
        {
            protected string _name;
            protected FofX_Imp _imp;

            public FofX(string name, FofX_Imp imp)
            {
                _name = name;
                _imp = imp;
            }

            public override string value(Context context)
            {
                return _imp();
            }

            public override string source()
            {
                return _name;
            }

            public static bool parse(Scanner scanner, string name, FofX_Imp imp, out SFunction tree)
            {
                tree = new FofX(name, imp);
                return true;
            }
        }
*/



class SLiteral extends StringExpression {

    public constructor(protected readonly text: string) {
        super();
    }

    public source() : string {
        return this.text
    }

    public value(context: Context) : string {
        // Trim off double quotes
        return this.text.substring(1, this.text.length-1)
    }

    public static parseLiteral(scanner: Scanner) : SLiteral {

        if (scanner.consumeString()) {
            return new SLiteral(scanner.current().text)
        }
        else {
            return <SLiteral>this.fail(scanner, ErrorCode.StatementNotRecognised, null)
        }
    }

}

class SBracket extends StringExpression {

    public constructor(protected readonly sexpr: StringExpression) {
        super()
    }

    public source() : string {
        return '(' + this.sexpr.source() + ')';
    }

    public value(context: Context) : string {
        return this.sexpr.value(context)
    }

    public static parseBracket(scanner: Scanner) : StringExpression {

        let expr: StringExpression
        if (scanner.consumeSymbol(TokenType.PAR)
        &&  (expr = StringExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.REN)) {
                return new SBracket(expr)
        }

        return null
    }
}

class SCatOp extends StringExpression {

    public constructor(protected readonly left: StringExpression, protected readonly right: StringExpression) {
        super()
    }

    public source() : string {
        return this.left.source() + "&" + this.right.source();
    }

    public value(context: Context) : string  {
        return this.left.value(context) + this.right.value(context)
    }
}

/*
abstract class SRef : StringExpression
{
    abstract public void set(Context context, string value);

    public static bool parse(Scanner scanner, out SRef tree)
    {
        if (!scanner.consume_sid())
        {
            tree = null;
            return false;
        }

        string sid = scanner.current()._text;

        // If we don't have a ( or [, this can only be a scalar
        if (!scanner.consume_symbol(Scanner.TokenType.PAR) && !scanner.consume_symbol(Scanner.TokenType.BRA))
        {
            tree = new SScalarRef(sid);
            return true;
        }

        // Having read a ( or [, the SRef production is no longer an
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
            tree = new SVectorRef(sid, col_expr);
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

        tree = new SArrayRef(sid, col_expr, row_expr);
        return true;
    }

    abstract public bool hasConstantSubscripts();

    abstract public void prepare(Context context);
}

class SScalarRef : SRef
{
    string _name;

    public SScalarRef(string name)
    {
        _name = name;
    }
    override public string value(Context context)
    {
        return context.getString(_name);
    }
    override public string source()
    {
        return _name;
    }
    override public void set(Context context, string value)
    {
        context.set(_name, value);
    }

    override public bool hasConstantSubscripts()
    {
        return false;
    }

    public override void prepare(Context context)
    {
        throw new NotImplementedException();
    }
}

class SVectorRef : SRef
{
    string _name;
    NumericExpression _col;
    public SVectorRef(string name, NumericExpression col_expr)
    {
        _name = name;
        _col = col_expr;
    }
    override public string value(Context context)
    {
        return context.getString(_name, _col.value(context));
    }
    override public string source()
    {
        return _name + '[' + _col.source() + ']';
    }
    override public void set(Context context, string value)
    {
        context.set(_name, _col.value(context), value);
    }
    override public bool hasConstantSubscripts()
    {
        return _col.isConstant();
    }
    public override void prepare(Context context)
    {
        context.dimString(_name, _col.value(context));
    }
}

class SArrayRef : SRef
{
    string _name;
    NumericExpression _col;
    NumericExpression _row;

    public SArrayRef(string name, NumericExpression col_expr, NumericExpression row_expr)
    {
        _name = name;
        _col = col_expr;
        _row = row_expr;
    }
    override public string value(Context context)
    {
        return context.getString(_name, _col.value(context), _row.value(context));
    }
    override public string source()
    {
        return _name + '[' + _col.source() + ',' + _row.source() + ']';
    }
    override public void set(Context context, string value)
    {
        context.set(_name, _col.value(context), _row.value(context), value);
    }
    override public bool hasConstantSubscripts()
    {
        return _col.isConstant() && _row.isConstant();
    }
    public override void prepare(Context context)
    {
        context.dimString(_name, _col.value(context), _row.value(context));
    }
}


*/