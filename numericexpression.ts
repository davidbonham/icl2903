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
               ||   NRef.parse(scanner)
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

    public compile(vm: Vm) {
        vm.emit([Op.PUSH, this._value])
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

    public compile(vm: Vm) {
        this.nexpr.compile(vm)
        vm.emit([Op.NEG])
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
        const result = Math.log(n)
        if (Number.isNaN(result)) throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)
        return result
    }

    // From the mozilla documentation for regexp
    protected static escapeRegExp(s: string) : string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    public static OCC(search: string, target: string) : number {
        if (target == "" || search == "") return 0
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
        if (Number.isNaN(result) || !Number.isFinite(result)) {
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
        else if (scanner.consumeUdfn())
            result = UdfN.parseUdfN(scanner, scanner.current().text)

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
        const args = Expression.parseArgList(scanner, "N")
        return args ? new FofN(name, func,
                               <NumericExpression>args[0],
                              ) : null
   }

    public compile(vm: Vm) {
       this.operand.compile(vm)
       vm.emit([Op.NFN, this.func])
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
        const args = Expression.parseArgList(scanner, "S")
        return args ? new FofS(name, func,
                               <StringExpression>args[0],
                              ) : null
   }

   public compile(vm: Vm) {
       this.operand.compile(vm)
       vm.emit([Op.NFS, this.func])
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

    public compile(vm: Vm) {
       vm.emit([Op.NF, this.func])
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
        const args = Expression.parseArgList(scanner, "SS")
        return args ? new FofSS(name, func,
                                <StringExpression>args[0],
                                <StringExpression>args[1],
                               ) : null
    }

    public compile(vm: Vm) {
       this.op1.compile(vm)
       this.op2.compile(vm)
       vm.emit([Op.NFSS, this.func])
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
        const args = Expression.parseArgList(scanner, "SSN")
        return args ? new FofSSN(name, func,
                                 <StringExpression>args[0],
                                 <StringExpression>args[1],
                                 <NumericExpression>args[2],
                                ) : null
    }

    public compile(vm: Vm) {
       this.op1.compile(vm)
       this.op2.compile(vm)
       this.op3.compile(vm)
       vm.emit([Op.NFSSN, this.func])
   }


}

namespace Udf  {

    export function source(name: string, args: (NumericExpression|StringExpression)[]) : string {
        return name + "(" + args.map(e => e.source()).join(",") + ")"
    }

    export function parseUdf(scanner: Scanner) : (NumericExpression|StringExpression)[] {

        // Consume a comma-separated list of expressions in parentheses.
        // The list may be empty
        let args: (NumericExpression|StringExpression)[] = []
        let sawComma = false
        if (scanner.consumeSymbol(TokenType.PAR)) {

            for(;;) {

                // We are positioned after a ( or a ,
                let arg: NumericExpression|StringExpression
                arg = NumericExpression.parse(scanner)
                if (!arg) arg = StringExpression.parse(scanner)

                // No argument parsed
                if (!arg) break

                // We have consumed an expression, so next we need a comma
                // or a closing parenthesis
                args.push(arg)
                sawComma = false

                // If there is another comma, we must loop for the next
                // argument, otherwise it must be the closing parenthesis
                sawComma = scanner.consumeSymbol(TokenType.COMMA)
                if (!sawComma) break
            }

            if (scanner.consumeSymbol(TokenType.REN)) return args
        }

        return null
    }
}

class UdfN extends NFunction {

    protected constructor(protected readonly name: string, protected readonly args: (NumericExpression|StringExpression)[]) {
        super()
    }

    public static parseUdfN(scanner: Scanner, name: string) : UdfN {
        // Our caller has already parsed our name
        const mark = scanner.mark()
        const args = Udf.parseUdf(scanner)
        return args ? new UdfN(name, args) : <UdfN>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
    }

    public source() : string {
        return Udf.source(this.name, this.args)
    }

    public value(context: Context) : number {
        const definition = context.root().program.getUdf(this.name)
        if (definition instanceof DefExpStmtN || definition instanceof DefBlockStmtN) {
            return definition.call(context, this.args)
        }
        else {
            // Parser should make this impossible
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }

}
class UdfS extends SFunction {

    protected constructor(protected readonly name: string, protected readonly args: (NumericExpression|StringExpression)[]) {
        super()
    }

    public static parseUdfS(scanner: Scanner, name: string) : UdfS {
        // Our caller has already parsed our name
        const mark = scanner.mark()
        const args = Udf.parseUdf(scanner)
        return args ? new UdfS(name, args) : <UdfS>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
    }

    public source() : string {
        return Udf.source(this.name, this.args)
    }

    public value(context: Context) : string {
        const definition = context.root().program.getUdf(this.name)
        if (definition instanceof DefExpStmtS || definition instanceof DefBlockStmtS) {
            return definition.call(context, this.args)
        }
        else {
            // Parser should make this impossible
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
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

    public compile(vm: Vm) {
        this.nexpr.compile(vm)
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

    public compile(vm: Vm) {

        this.lhs.compile(vm)
        this.rhs.compile(vm)

        switch (this.op.type)
        {
            case TokenType.KEY:
                if (this.op.text == "MIN") {
                    vm.emit1(Op.MIN)
                }
                else if (this.op.text == "MAX") {
                    vm.emit1(Op.MAX)
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.BugCheck);
                }
                break;
            case TokenType.ADD:
                vm.emit1(Op.ADD)
                break;
            case TokenType.SUB:
                vm.emit1(Op.SUB)
                break;
            case TokenType.MUL:
                vm.emit1(Op.MUL)
                break;
            case TokenType.DIV:
                vm.emit1(Op.DIV)
                break;
            case TokenType.POW1:
            case TokenType.POW2:
                vm.emit1(Op.POW)
                break;
            default:
                throw new Utility.RunTimeError(ErrorCode.BugCheck);
        }
    }

}


abstract class NRef extends NumericExpression
{
    public abstract  set(context: Context, value: number) : void
    public abstract  hasConstantSubscripts() : boolean
    public prepare(context: Context) {
    }

    public abstract compileAssign(vm: Vm) : void

    public static parse(scanner: Scanner) : NRef  {
        if (!scanner.consumeNid()) {
            return null;
        }

        const nid = scanner.current().text;

        // If we don't have a ( or [, this can only be a scalar
        if (!scanner.consumeSymbol(TokenType.PAR) && !scanner.consumeSymbol(TokenType.BRA)) {
            return new NScalarRef(nid)
        }

        // Having read a ( or [, the NRef production is no longer an
        // optional parse - we must complete it or fail with a syntax
        // error. From now on, we can't return false. It's a vector or
        // an array so we must have at least one subscript.
        const colExpr = NumericExpression.parse(scanner)
        if (!colExpr) return null

        // Now we must have either a comma, indicating this is an array
        // rather than a vector, or a ) or ], indicating this as a
        // vector.
        if (scanner.consumeSymbol(TokenType.REN) || scanner.consumeSymbol(TokenType.KET)) {
            return new NVectorRef(nid, colExpr)
        }

        // Only alternative is the rest of an array reference: "," next "]"
        if (!scanner.consumeSymbol(TokenType.COMMA)) return null

        const rowExpr = NumericExpression.parse(scanner)
        if (!rowExpr) return null

        if (!scanner.consumeSymbol(TokenType.REN) && !scanner.consumeSymbol(TokenType.KET)) return null

        return new NArrayRef(nid, colExpr, rowExpr)
    }
}

class NScalarRef extends NRef {

    public constructor(protected readonly name: string) {
        super()
    }

    public value(context: Context) : number {
        return context.state().getNumber(this.name)
    }

    public source() : string {
        return this.name
    }

    public set(context: Context, value: number) : void {
        context.state().setScalar(this.name, value)
    }

    public same(other: NScalarRef) : boolean {
        return this.name == other.name
    }

    public hasConstantSubscripts() : boolean {
        return false
    }

    public compile(vm: Vm) {
        vm.emit([Op.SN, this.name])
    }

    public compileAssign(vm: Vm) {
        // The value to be assigned is on the top of the stack so all we
        // need to do is set the variable
        vm.emit([Op.SSN, this.name])
    }

    public static SSN(context: Context, id: string, value: number) {
        context.state().setScalar(id, value)
    }

    public static SN(context: Context, id: string) : number {
        return context.state().getNumber(id)
    }
}

class NVectorRef extends NRef
{
    public constructor (protected readonly name: string, protected readonly col: NumericExpression) {
        super()
    }

    public value(context: Context) : number {
        return context.state().getVector(this.name, this.col.value(context))
    }

    public source() : string {
        return this.name + '[' + this.col.source() + ']'
    }

    public set(context: Context, value: number) : void {
        context.state().setVector(this.name, this.col.value(context), value)
    }

    public hasConstantSubscripts() : boolean {
        return this.col.isConstant()
    }

    public  prepare(context: Context) : void {
        context.state().dimVector(this.name, this.col.value(context))
    }

    public compile(vm: Vm) {
        this.col.compile(vm)
        vm.emit([Op.VN, this.name])
    }

    public compileAssign(vm: Vm) {
        // The value to be assigned is on the top of the stack so we need
        // to generate code to evaluate the vector index and then assign
        // the value to the array element
        this.col.compile(vm)
        vm.emit([Op.SVN, this.name])
    }

    public static SVN(context: Context, id: string, col: number, value: number) : void {
        context.state().setVector(id, col, value)
    }

    public static VN(context: Context, id: string, col: number) : number {
        return context.state().getVector(id, col)
    }


}

class NArrayRef extends NRef
{

    public constructor(protected readonly name: string,
                       protected readonly col: NumericExpression,
                       protected readonly row: NumericExpression){
        super()
    }

    public value(context: Context) : number {
        return context.state().getArray(this.name, this.col.value(context), this.row.value(context))
    }

    public static AN(context: Context, id: string, col: number, row: number) : number {
        return context.state().getArray(id, col, row)
    }

    public static SAN(context: Context, id: string, col: number, row: number, value: number) : void {
        context.state().setArray(id, col, row, value)
    }

    public source() : string {
        return this.name + '[' + this.col.source() + ',' + this.row.source() + ']';
    }

    public set(context: Context, value: number) : void {
        context.state().setArray(this.name, this.col.value(context), this.row.value(context), value)
    }

    public hasConstantSubscripts() : boolean {
        return this.col.isConstant() && this.row.isConstant()
    }

    public prepare(context: Context) : void
    {
        context.state().dimArray(this.name, this.col.value(context), this.row.value(context))
    }

    public compile(vm: Vm) {
        this.col.compile(vm)
        this.row.compile(vm)
        vm.emit([Op.AN, this.name])
    }

    public compileAssign(vm: Vm) {
        // The value to be assigned is on the top of the stack so we need
        // to generate code to evaluate the array indices and then assign
        // the value to the array element
        this.col.compile(vm)
        this.row.compile(vm)
        vm.emit([Op.SAN, this.name])
    }

}
