abstract class LogicalExpression {


    protected static isBinaryOperator(scanner: Scanner) : boolean {
        return scanner.consumeSymbol(TokenType.EQ)
            || scanner.consumeSymbol(TokenType.GE)
            || scanner.consumeSymbol(TokenType.GT)
            || scanner.consumeSymbol(TokenType.HASH)
            || scanner.consumeSymbol(TokenType.LE)
            || scanner.consumeSymbol(TokenType.LT)
            || scanner.consumeSymbol(TokenType.NE)
            || scanner.consumeKeyword("AND")
            || scanner.consumeKeyword("OR")
            || scanner.consumeKeyword("XOR")
            || scanner.consumeKeyword("EQV")
            || scanner.consumeKeyword("IMP")
            || scanner.consumeKeyword("AND");
    }

    protected static precedence(token: Token) : number {
        if (token.text == "AND") return 1
        if (token.text == "OR") return 2
        if (token.text == "XOR") return 3
        if (token.text == "IMP") return 4
        if (token.text == "EQV") return 5
        return 0
    }

    protected static expression(scanner: Scanner, callerPrecedence: number) : LogicalExpression
    {
        let tree: LogicalExpression = LogicalExpression.primary(scanner)
        if (tree) {
            for (;;) {
                // Is there another part of this expression - it will be a
                // binary operator - either a symbol or a keyword.
                const pos = scanner.mark();
                if (!LogicalExpression.isBinaryOperator(scanner)) return tree

                // If it's of lower precedence, we have finished this
                // subexpression, so don't consume this token
                const next: Token = scanner.current()
                const nextPrecedence = LogicalExpression.precedence(next)
                if (nextPrecedence < callerPrecedence) {
                    scanner.restore(pos)
                    return tree
                }

                // Moving on the the rhs of this operator,w e must parse an RHS
                const rhs = LogicalExpression.expression(scanner, nextPrecedence)
                if (!rhs) return tree
                tree = new LBinOp(next, tree, rhs)
            }
        }
        else {
            return null
        }
    }

    private static primary(scanner: Scanner) : LogicalExpression {
        const expr = LNot.parse(scanner)
                ||   LBracket.parse(scanner)
                ||   LNumericRelation.parse(scanner)
                ||   LStringRelation.parse(scanner)
        return expr
    }

    public static parse(scanner: Scanner) : LogicalExpression {
        return LogicalExpression.expression(scanner, 0)
    }

    public abstract source() : string

    public abstract value(context: Context) : boolean
}



class LNot extends LogicalExpression {

    public constructor(protected readonly expr: LogicalExpression) {
        super()
    }

    public source() : string {
        return "NOT " + this.expr.source()
    }

    public value(context: Context) : boolean {
        return !this.expr.value(context)
    }

    public static parse(scanner: Scanner) : LNot {

        let subexpression: LogicalExpression
        if (scanner.consumeKeyword("NOT") && (subexpression = LogicalExpression.expression(scanner, 3)) ) {
            return new LNot(subexpression)
        }
        else {
            return null;
        }
    }
}

class LBracket extends LogicalExpression {

    public constructor(protected readonly expr: LogicalExpression) {
        super()
    }

    public source() : string {
        return '(' + this.expr.source() + ')';
    }

    public value(context: Context) : boolean {
        return this.expr.value(context);
    }

    public static parse(scanner: Scanner) : LBracket {

        const mark = scanner.mark()

        if (scanner.consumeSymbol(TokenType.PAR))
        {
            const expr = LogicalExpression.expression(scanner, 0)
            if (!expr)  {
                // We have consumed the ( but that might have been a
                // NBracket or SBracket.
                scanner.restore(mark)
            }
            if (scanner.consumeSymbol(TokenType.REN)) {
                return new LBracket(expr)
            }
        }

        return null
    }
}

class LNumericRelation extends LogicalExpression {

    public constructor(protected readonly op: Token,
                       protected readonly lhs: NumericExpression,
                       protected readonly rhs: NumericExpression) {
        super()
    }

    public source() : string {
        return this.lhs.source() + this.op.text + this.rhs.source()
    }

    public value(context: Context) : boolean {

        const lhs = this.lhs.value(context)
        const rhs = this.rhs.value(context)
        switch (this.op.type) {
            case TokenType.EQ:
                return lhs == rhs
            case TokenType.GE:
                return lhs >= rhs
            case TokenType.GT:
                return lhs > rhs
            case TokenType.HASH:
            case TokenType.NE:
                return lhs != rhs
            case TokenType.LE:
                return lhs <= rhs
            case TokenType.LT:
                return lhs < rhs
            default:
                throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    protected static parseRelation(scanner: Scanner) : Token
    {
        const isRelation = scanner.consumeSymbol(TokenType.EQ)
                        || scanner.consumeSymbol(TokenType.GE)
                        || scanner.consumeSymbol(TokenType.GT)
                        || scanner.consumeSymbol(TokenType.HASH)
                        || scanner.consumeSymbol(TokenType.NE)
                        || scanner.consumeSymbol(TokenType.LE)
                        || scanner.consumeSymbol(TokenType.LT)
        return isRelation ? scanner.current() : null
    }

    public static parse(scanner: Scanner) : LNumericRelation
    {
        let lhs: NumericExpression
        let rhs: NumericExpression
        let op:  Token
        if ((lhs = NumericExpression.parse(scanner))
         && (op  = LNumericRelation.parseRelation(scanner))
         && (rhs = NumericExpression.parse(scanner)) ) {
            return new LNumericRelation(op, lhs, rhs);
        }
        else {
            return null
        }
    }
}

class LStringRelation extends LogicalExpression {

    public constructor(protected readonly op:  Token,
                       protected readonly lhs: StringExpression,
                       protected readonly rhs: StringExpression) {
                           super()
    }

    public source() : string {
        return this.lhs.source() + this.op.text + this.rhs.source()
    }

    public value(context: Context) : boolean {

        const lhs = this.lhs.value(context)
        const rhs = this.rhs.value(context)

        switch (this.op.type) {

            case TokenType.EQ:
                return lhs == rhs
            case TokenType.GE:
                return lhs >= rhs
            case TokenType.GT:
                return lhs > rhs
            case TokenType.HASH:
            case TokenType.NE:
                return lhs != rhs
            case TokenType.LE:
                return lhs <= rhs
            case TokenType.LT:
                return lhs < rhs
            default:
                throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    protected static parseRelation(scanner: Scanner) : Token {

        if (scanner.consumeSymbol(TokenType.EQ)
         || scanner.consumeSymbol(TokenType.GE)
         || scanner.consumeSymbol(TokenType.GT)
         || scanner.consumeSymbol(TokenType.HASH)
         || scanner.consumeSymbol(TokenType.NE)
         || scanner.consumeSymbol(TokenType.LE)
         || scanner.consumeSymbol(TokenType.LT)) {
             return scanner.current()
        }
        else {
            return null
        }
    }

    public static parseStringRelation(scanner: Scanner) : LStringRelation
    {
        let lhs: StringExpression
        let rhs: StringExpression
        let op: Token

        if ((lhs = StringExpression.parse(scanner))
        &&  (op  = this.parseRelation(scanner))
        &&  (rhs = StringExpression.parse(scanner))) {
            return new LStringRelation(op, lhs, rhs);
        }
        else {
            return null
        }
    }
}

class LBinOp extends LogicalExpression {

    public constructor(protected readonly op : Token,
                       protected readonly lhs: LogicalExpression,
                       protected readonly rhs:  LogicalExpression) {
        super()
    }

    public source() : string {
        return this.lhs.source() + ' ' + this.op.text + ' ' + this.rhs.source()
    }

    public value(context: Context) : boolean {
        const lhs = this.lhs.value(context)
        const rhs = this.rhs.value(context)
        if (this.op.text == "AND") return lhs && rhs
        if (this.op.text == "OR") return lhs || rhs
        if (this.op.text == "XOR") return lhs != rhs
        if (this.op.text == "EQV") return lhs == rhs
        if (this.op.text == "IMP") return !lhs || rhs
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }
}
