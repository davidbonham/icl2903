/// <reference path="ast.ts" />

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
        return Math.abs(n)
    }

    public static ATN(n: number) : number {
        return Math.atan(n);
    }

    public static COS(n: number) : number {
        return Math.cos(n)
    }

    public static CPI() : number {
        return Math.PI
    }

    public static EPS() : number {
        return Number.EPSILON
    }

    public static EXP (n: number) : number {
        return Math.exp(n)
    }

    public static INF() : number {
        return NumericExpression.MAXIMUM
    }

    public static INT(n: number) : number {
        return Math.floor(n)
    }

    public static LEN(s: string) : number {
        return s.length
    }

    public static LIN(s: string) : number {
        return  (s.match(/\n/g)||[]).length
    }

    public static LOG(n: number) : number {
        return Math.log(n)
    }

    // From the mozilla documentation for regexp
    protected static escapeRegExp(s: string) : string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    public static OCC(search: string, target: string) : number {
        return (search.match(RegExp(NFunction.escapeRegExp(target), "g"))||[]).length
    }

    public static POS(search: string, target: string, occurrence: number = 1) : number {
        return NFunction.position(search, target, 0, Math.floor(occurrence));
    }

    protected static position(search: string, target: string, offset: number, occurrence: number) : number {
        // Test for invalid arguments.
        if (occurrence <= 0 || target == "") return 0;

        // See if there's a match
        var location = search.indexOf(target);
        if (location == -1) return 0;

        if (occurrence == 1) {
            // This is the required one. Convert 0-based index to 1-based
            return location + offset + 1;
        }
        else {
            // Look for the next one
            var searchFrom = location + target.length;
            return NFunction.position(search.substring(searchFrom), target, offset + searchFrom, occurrence - 1);
        }
    }

    public static RND() : number {
        return Math.random()
    }

    public static SGN(n : number) : number {
        return Math.sign(n)
    }

    public static SIN(n: number) : number {
        return Math.sin(n)
    }

    public static CHR(s: string) : number {
        if (s.length == 0) throw new Utility.RunTimeError(ErrorCode.InvArg)
        const code = Scanner.characterSet.indexOf(s[0])
        if (code == -1) throw new Utility.RunTimeError(ErrorCode.BugCheck)
        return code
    }

    public static SQR(n: number) : number {
        if (n < 0.0) throw new Utility.RunTimeError(ErrorCode.SquareRootNegative)
        return Math.sqrt(n)
    }

    public static TAN(n: number) : number {
        return Math.tan(n)
    }

    public static VAL(s: string) : number {
        const result = +s
        if (result == Number.NaN || result == Number.POSITIVE_INFINITY || result == Number.POSITIVE_INFINITY) {
            throw new Utility.RunTimeError(ErrorCode.InvString)
        }
        return result
    }


    public static parse(scanner: Scanner) : NumericExpression  {

        const start_mark = scanner.mark();
        let result: NFunction = null
        if (scanner.consumeBifn("ABS"))
            result = FofN.parseFofN(scanner, "ABS", NFunction.ABS)
        else if (scanner.consumeBifn("ATN"))
            result = FofN.parseFofN(scanner, "ATN", NFunction.ATN)
        else if (scanner.consumeBifn("COS"))
            result = FofN.parseFofN(scanner, "COS", NFunction.COS)
        else if (scanner.consumeBifn("CHR"))
            result = FofS.parseFofS(scanner, "CHR", NFunction.CHR)
        else if (scanner.consumeBifn("CPI"))
            result = FofX.parseFofX(scanner, "CPI", NFunction.CPI)
        else if (scanner.consumeBifn("EPS"))
            result = FofX.parseFofX(scanner, "EPS", NFunction.EPS)
        else if (scanner.consumeBifn("EXP"))
            result = FofN.parseFofN(scanner, "EXP", NFunction.EXP)
        else if (scanner.consumeBifn("INF"))
            result = FofX.parseFofX(scanner, "INF", NFunction.INF)
        else if (scanner.consumeBifn("INT"))
            result = FofN.parseFofN(scanner, "INT", NFunction.INT)
        else if (scanner.consumeBifn("LEN"))
            result = FofS.parseFofS(scanner, "LEN", NFunction.LEN)
        else if (scanner.consumeBifn("LIN"))
            result = FofS.parseFofS(scanner, "LIN", NFunction.LIN)
        else if (scanner.consumeBifn("LOG"))
            result = FofN.parseFofN(scanner, "LOG", NFunction.LOG)
        else if (scanner.consumeBifn("OCC"))
            result = FofSS.parseFofSS(scanner, "OCC", NFunction.OCC)
        else if (scanner.consumeBifn("POS"))
        {
            var mark = scanner.mark();
            result = FofSS.parseFofSS(scanner, "POS", NFunction.POS)
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSN.parseFofSSN(scanner, "POS", NFunction.POS)
            }
        }
        else if (scanner.consumeBifn("RND"))
            result = FofX.parseFofX(scanner, "RND", NFunction.RND)
        else if (scanner.consumeBifn("SGN"))
            result = FofN.parseFofN(scanner, "SGN", NFunction.SGN)
        else if (scanner.consumeBifn("SIN"))
            result = FofN.parseFofN(scanner, "SIN", NFunction.SIN)
        else if (scanner.consumeBifn("SQR"))
            result = FofN.parseFofN(scanner, "SQR", NFunction.SQR)
        else if (scanner.consumeBifn("TAN"))
            result = FofN.parseFofN(scanner, "TAN", NFunction.TAN)
        else if (scanner.consumeBifn("VAL"))
            result = FofS.parseFofS(scanner, "VAL", NFunction.VAL)


        if (result == null) scanner.restore(start_mark)
        return result
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

        return result
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

class FofS extends NFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s: string) => number,
                       protected readonly operand: StringExpression) {
        super()
     }

    public value(context: Context) : number {

        // Evaluate the operand
        const value = this.operand.value(context)

        // Apply our function to it
        const result = this.func(value)

        // Check we're still in range on ICL2903 BASIC
        if (result < -NumericExpression.MAXIMUM || NumericExpression.MAXIMUM < result) {
            throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)
        }

        return result
    }

    public source() : string {
        return this.name + '(' + this.operand.source() + ')';
    }

    public static parseFofS(scanner: Scanner, name: string, func: (b: string) => number) : NFunction {
        if (scanner.consumeSymbol(TokenType.PAR)) {
            const operand = StringExpression.parse(scanner)
            if (operand && scanner.consumeSymbol(TokenType.REN)) {
                return new FofS(name, func, operand);
            }
        }
        return null
   }
}

class FofX extends NFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: () => number) {
        super()
    }

    public value(context: Context) : number {
        return this.func()
    }

    public source() : string {
        return this.name
    }

    public static parseFofX(scanner: Scanner, name: string, func: ()=>number) : FofX {
        return new FofX(name, func);
    }
}

class FofSS extends NFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (a: string, b: string) => number,
                       protected readonly op1: StringExpression,
                       protected readonly op2: StringExpression) {
        super()
    }

    public value(context: Context) : number {
        const op1 : string = this.op1.value(context)
        const op2 : string = this.op2.value(context)
        return this.func(op1, op2)
    }

    public source() : string {
        return this.name + '(' + this.op1.source() + ',' + this.op2.source() + ')'
    }

    public static parseFofSS(scanner: Scanner, name: string, func: (a: string, b: string) => number) : FofSS {
        let op1: StringExpression
        let op2: StringExpression

        if (scanner.consumeSymbol(TokenType.PAR)
        &&  (op1 = StringExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.COMMA)
        &&  (op2 = StringExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.REN)) {
            return new FofSS(name, func, op1, op2);
        }

        return null
    }
}

class FofSSN extends NFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (a: string, b: string, c: number) => number,
                       protected readonly op1: StringExpression,
                       protected readonly op2: StringExpression,
                       protected readonly op3: NumericExpression) {
        super()
    }

    public value(context: Context) : number {
        const op1 : string = this.op1.value(context)
        const op2 : string = this.op2.value(context)
        const op3 : number = this.op3.value(context)
        return this.func(op1, op2, op3)
    }

    public source() : string {
        return this.name + '(' + this.op1.source() + ',' + this.op2.source() + ',' + this.op2.source() + ')'
    }

    public static parseFofSSN(scanner: Scanner, name: string, func: (a: string, b: string, c:number) => number) : FofSSN {
        let op1: StringExpression
        let op2: StringExpression
        let op3: NumericExpression

        if (scanner.consumeSymbol(TokenType.PAR)
        &&  (op1 = StringExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.COMMA)
        &&  (op2 = StringExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.COMMA)
        &&  (op3 = NumericExpression.parse(scanner))
        &&  scanner.consumeSymbol(TokenType.REN)) {
            return new FofSSN(name, func, op1, op2, op3);
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

