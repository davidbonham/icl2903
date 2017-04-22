/// <reference path="ast.ts" />

abstract class StringExpression extends Expression {

    protected static primary(scanner: Scanner) : StringExpression {

        return SLiteral.parseLiteral(scanner)
        ||     SBracket.parseBracket(scanner)
        ||     SFunction.parseFunction(scanner)
        ||     SRef.parse(scanner)

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

    protected static DEL1(s1: string, s2: string) : string {
        return SFunction.DEL(s1, s2, 1)
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

    protected static REP1(s1: string, s2: string, s3: string) : string {
        return SFunction.REP(s1, s2, s3, 1)
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

    protected static SDL0(s1: string, s2: string) : string {
        return SFunction.SDL(s1, s2, 0)
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

    protected static SRP0(s1: string, s2: string, s3: string) : string {
        return SFunction.SRP(s1, s2, s3, 0)
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
            result = FofN$.parseFofN$(scanner, "CHR$", SFunction.CHR)
        else if (scanner.consumeBifs("DAT$"))
            result = FofX$.parseFofX$(scanner, "DAT$", SFunction.DAT)
        else if (scanner.consumeBifs("DEL$")) {
            var mark = scanner.mark();
            result = FofSS$.parseFofSS$(scanner, "DEL$", SFunction.DEL1)
            if (!result) {
                scanner.restore(mark);
                result = FofSSN$.parseFofSSN$(scanner, "DEL$", SFunction.DEL)
            }
        }
        else if (scanner.consumeBifs("GAP$"))
            result = FofN$.parseFofN$(scanner, "GAP$", SFunction.GAP)
        else if (scanner.consumeBifs("LIN$"))
            result = FofN$.parseFofN$(scanner, "LIN$", SFunction.LIN)
        else if (scanner.consumeBifs("MUL$"))
            result = FofSN$.parseFofSN$(scanner, "MUL$", SFunction.MUL);
        else if (scanner.consumeBifs("REP$"))
        {
            var mark = scanner.mark();
            result = FofSSS$.parseFofSSS$(scanner, "REP$", SFunction.REP1)
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSSN$.parseFofSSSN$(scanner, "REP$", SFunction.REP)
            }
        }
        else if (scanner.consumeBifs("SDL$")) {
            var mark = scanner.mark();
            result = FofSS$.parseFofSS$(scanner, "SDL$", SFunction.SDL0)
            if (!result)
            {
                scanner.restore(mark);
                result = FofSSN$.parseFofSSN$(scanner, "SDL$", SFunction.SDL)
            }
        }
        else if (scanner.consumeBifs("SEG$")) {
            var mark = scanner.mark();
            result = FofSN$.parseFofSN$(scanner, "SEG$", SFunction.SEG1)
            if (!result)
            {
                scanner.restore(mark);
                result = FofSNN$.parseFofSNN$(scanner, "SEG$", SFunction.SEG2)
            }
        }
        else if (scanner.consumeBifs("SGN$"))
            result = FofN$.parseFofN$(scanner, "SGN$", SFunction.SGN)
        else if (scanner.consumeBifs("SRP$")) {
            var mark = scanner.mark();
            result = FofSSS$.parseFofSSS$(scanner, "SRP$", SFunction.SRP0)
            if (!result) {
                scanner.restore(mark);
                result = FofSSSN$.parseFofSSSN$(scanner, "SRP$", SFunction.SRP)
            }
        }
        else if (scanner.consumeBifs("STR$"))
            result = FofN$.parseFofN$(scanner, "STR$", SFunction.STR)
        else if (scanner.consumeBifs("SUB$")) {
            var mark = scanner.mark();
            result = FofSN$.parseFofSN$(scanner, "SUB$", SFunction.SUB1)
            if (!result) {
                scanner.restore(mark);
                result = FofSNN$.parseFofSNN$(scanner, "SUB$", SFunction.SUB2)
            }
        }
        else if (scanner.consumeBifs("TIM$"))
            result = FofX$.parseFofX$(scanner, "TIM$", SFunction.TIM)
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

    public static parseFofN$(scanner: Scanner, name: string, func: (n:number) => string) : FofN$ {
        const args = Expression.parseArgList(scanner, "N")
        return args ? new FofN$(name, func, <NumericExpression>args[0]) : null
    }
}

class FofX$ extends SFunction {

    public constructor(protected readonly name: string, protected readonly func: () => string) {
        super()
    }

    public value(context: Context) : string {
        return this.func()
    }

    public source() : string {
        return this.name
    }

    public static parseFofX$(scanner: Scanner, name: string, func: () => string) : FofX$ {
        return new FofX$(name, func);
    }
}

class FofSS$ extends SFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, s2: string) => string,
                       protected readonly s1: StringExpression,
                       protected readonly s2: StringExpression) {
        super()
    }

    public value(context: Context) : string {
        const s1 = this.s1.value(context)
        const s2 = this.s2.value(context)
        return this.func(s1, s2)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.s2.source() + ')'
    }

    public static parseFofSS$(scanner: Scanner, name: string, func: (s1: string, s2: string) => string) : FofSS$ {
        const args = Expression.parseArgList(scanner, "SS")
        return args ? new FofSS$(name, func, <StringExpression>args[0], <StringExpression>args[1]) : null
    }
}

class FofSSS$ extends SFunction
{

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, s2: string, s3: string) => string,
                       protected readonly s1: StringExpression,
                       protected readonly s2: StringExpression,
                       protected readonly s3: StringExpression) {
        super()
    }

    public value(context: Context): string {
        const s1 = this.s1.value(context)
        const s2 = this.s2.value(context)
        const s3 = this.s3.value(context)
        return this.func(s1, s2, s3)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.s2.source() + ',' + this.s3.source() + ')';
    }


    public static parseFofSSS$(scanner: Scanner, name: string, func: (s1: string, s2: string, s3: string) => string) : FofSSS$ {
        const args = Expression.parseArgList(scanner, "SSS")
        return args ? new FofSSS$(name, func,
                                  <StringExpression>args[0],
                                  <StringExpression>args[1],
                                  <StringExpression>args[2],
                                  ) : null
    }
}

class FofSSSN$ extends SFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, s2: string, s3: string, n4: number) => string,
                       protected readonly s1: StringExpression,
                       protected readonly s2: StringExpression,
                       protected readonly s3: StringExpression,
                       protected readonly n4: NumericExpression) {
        super()
    }

    public value(context: Context) {
        const s1 = this.s1.value(context)
        const s2 = this.s2.value(context)
        const s3 = this.s3.value(context)
        const n4 = this.n4.value(context)
        return this.func(s1, s2, s3, n4)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.s2.source() + ',' + this.s3.source() + ',' + this.n4.source() + ')';
    }

    public static parseFofSSSN$(scanner: Scanner, name: string, func: (s1: string, s2: string, s3: string, n4: number) => string) : FofSSSN$ {
        const args = Expression.parseArgList(scanner, "SSSN")
        return args ? new FofSSSN$(name, func,
                                   <StringExpression>args[0],
                                   <StringExpression>args[1],
                                   <StringExpression>args[2],
                                   <NumericExpression>args[3],
                                  ) : null
    }
}
class FofSN$ extends SFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, n2: number) => string,
                       protected readonly s1: StringExpression,
                       protected readonly n2: NumericExpression) {
        super()
    }

    public value(context: Context) {
        const s1 = this.s1.value(context)
        const n2 = this.n2.value(context)
        return this.func(s1, n2)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.n2.source() + ')';
    }

    public static parseFofSN$(scanner: Scanner, name: string, func: (s1: string, n2: number) => string) : FofSN$ {
        const args = Expression.parseArgList(scanner, "SN")
        return args ? new FofSN$(name, func,
                                 <StringExpression>args[0],
                                 <NumericExpression>args[1],
                                ) : null
    }
}


class FofSSN$ extends SFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, s2: string, n3: number) => string,
                       protected readonly s1: StringExpression,
                       protected readonly s2: StringExpression,
                       protected readonly n3: NumericExpression) {
        super()
    }

    public value(context: Context) {
        const s1 = this.s1.value(context)
        const s2 = this.s2.value(context)
        const n3 = this.n3.value(context)
        return this.func(s1, s2, n3)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.s2.source() + ',' + this.n3.source() + ')';
    }

    public static parseFofSSN$(scanner: Scanner, name: string, func: (s1: string, s2: string, n3: number) => string) : FofSSN$ {
        const args = Expression.parseArgList(scanner, "SSN")
        return args ? new FofSSN$(name, func,
                                   <StringExpression>args[0],
                                   <StringExpression>args[1],
                                   <NumericExpression>args[2],
                                  ) : null
    }
}

class FofSNN$ extends SFunction {

    public constructor(protected readonly name: string,
                       protected readonly func: (s1: string, n2: number, n3: number) => string,
                       protected readonly s1: StringExpression,
                       protected readonly n2: NumericExpression,
                       protected readonly n3: NumericExpression) {
        super()
    }

    public value(context: Context) {
        const s1 = this.s1.value(context)
        const n2 = this.n2.value(context)
        const n3 = this.n3.value(context)
        return this.func(s1, n2, n3)
    }

    public source() : string {
        return this.name + '(' + this.s1.source() + ',' + this.n2.source() + ',' + this.n3.source() + ')';
    }

    public static parseFofSNN$(scanner: Scanner, name: string, func: (s1: string, n2: number, n3: number) => string) : FofSNN$ {
        const args = Expression.parseArgList(scanner, "SNN")
        return args ? new FofSNN$(name, func,
                                   <StringExpression>args[0],
                                   <NumericExpression>args[1],
                                   <NumericExpression>args[2],
                                  ) : null
    }
}




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


abstract class SRef extends StringExpression {

    public abstract set$(context: Context, value: string) : void

    public static parse(scanner: Scanner) : SRef  {
        if (!scanner.consumeSid()) return null

        const sid = scanner.current().text

        // If we don't have a ( or [, this can only be a scalar
        if (!scanner.consumeSymbol(TokenType.PAR) && !scanner.consumeSymbol(TokenType.BRA)) {
            return new SScalarRef(sid)
        }

        // Having read a ( or [, the SRef production is no longer an
        // optional parse - we must complete it or fail with a syntax
        // error. From now on, we can't return false. It's a vector or
        // an array so we must have at least one subscript.
        const colExpr = NumericExpression.parse(scanner)
        if (!colExpr) return null

        // Now we must have either a comma, indicating this is an array
        // rather than a vector, or a ) or ], indicating this as a
        // vector.
        if (scanner.consumeSymbol(TokenType.REN) || scanner.consumeSymbol(TokenType.KET)) {
            return new SVectorRef(sid, colExpr)
        }

        // Having read a ( or [, the SRef production is no longer an
        // optional parse - we must complete it or fail with a syntax
        // error. From now on, we can't return false.
        if (!scanner.consumeSymbol(TokenType.COMMA)) return null

        const rowExpr = NumericExpression.parse(scanner)
        if (!rowExpr) return null

        if (!scanner.consumeSymbol(TokenType.REN) && !scanner.consumeSymbol(TokenType.KET)) {
            return null
        }

        return new SArrayRef(sid, colExpr, rowExpr);
    }

    public abstract hasConstantSubscripts() : boolean

    public prepare(context: Context) {
    }
}

class SScalarRef extends SRef {

    public constructor(protected readonly name: string) {
        super()
    }

    public value(context: Context) : string {
        return context.getString(this.name)
    }

    public source() : string {
        return this.name
    }

    public set$(context: Context, value: string) {
        context.set$(this.name, value)
    }

    public hasConstantSubscripts() : boolean {
        return false
    }
}

class SVectorRef extends SRef {

    public constructor(protected readonly name: string, protected readonly col: NumericExpression) {
        super()
    }

    public value(context: Context) : string {
        return context.getVector$(this.name, this.col.value(context))
    }

    public source() : string {
        return this.name + '[' + this.col.source() + ']'
    }

    public set$(context: Context, value: string) : void {
        context.setVector$(this.name, this.col.value(context), value)
    }

    public hasConstantSubscripts() : boolean {
        return this.col.isConstant();
    }

    public prepare(context: Context) : void {
        context.dimVector$(this.name, this.col.value(context))
    }
}

class SArrayRef extends SRef {

    public constructor(protected readonly name: string,
                       protected readonly col: NumericExpression,
                       protected readonly row: NumericExpression) {
        super()
    }
    public value(context: Context) : string {
        return context.getArray$(this.name, this.col.value(context), this.row.value(context))
    }

    public source() : string {
        return this.name + '[' + this.col.source() + ',' + this.row.source() + ']'
    }

    public set$(context: Context, value: string) : void {
        context.setArray$(this.name, this.col.value(context), this.row.value(context), value)
    }

    public hasConstantSubscripts() : boolean {
        return this.col.isConstant() && this.row.isConstant();
    }

    public prepare(context: Context) : void {
        context.dimArray$(this.name, this.col.value(context), this.row.value(context));
    }
}

