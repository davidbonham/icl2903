/**
 * User defined functions. These can be defined in a single line:
 *
 * DEF FNA(X) = SIN(X) + COS(X)
 *
 * or in a block, with optional local variables after the parameter list
 *
 * 100 DEF FNS(A,B) I,R         // I and R are local to this block
 * 110 R=0
 * 120 FOR I=A TO B
 * 130 R = R + I*I
 * 140 NEXT I
 * 150 FNS=R                    // Set the result of the function call
 * 160 FNEND                    // End the definition
 *
 */

// A comma-separated list of parameters or locals. The list may be empty
// but the items, if present, must be scalars and not vector or array
// elements.

type variable = NScalarRef | SScalarRef

class VariableList {

    protected constructor(public readonly variables: variable[]) {
    }

    public static unique(lists: VariableList[]) : boolean {
        let nameSet : {[name: string] : boolean} = {}
        for (const list of lists) {
            for (const id of list.variables) {
                const source = id.source()
                if (source in nameSet) return false
                nameSet[source ] = true
            }
        }

        return true
    }

    public static parse(scanner: Scanner) : VariableList {
        let result : variable[] = []
        let sawComma = false
        for (;;) {

            if (scanner.consumeNid()) {
                result.push(new NScalarRef(scanner.current().text))
                sawComma = false
            }
            else if (scanner.consumeSid()) {
                result.push(new NScalarRef(scanner.current().text))
                sawComma = false
            }
            else {
                break
            }

            // We just read a variable. If we can consume another comma,
            // there must be another one.
            if (!scanner.consumeSymbol(TokenType.COMMA)) break
            sawComma = true
        }

        // No more variables but if there was a comma this is a
        // syntax error
        return sawComma ? null : new VariableList(result)
    }

    public source() : string {
        return this.variables.map(v => v.source()).join(",")
    }
}

abstract class DefUdf extends Statement {

    protected constructor(protected readonly name: string, protected readonly parameters: VariableList) {
        super()
    }

    public prepare(context: Context, line: number) {
        context.owner.declareUdf(this.name, line)
    }

    public execute(context: Context) : boolean {
        return false
    }

    protected setupContext(context: Context, args: (StringExpression|NumericExpression)[]) : Context {

        // We need to check that the right number of arguments have been
        // provided  and that the types match because the parser could
        // not do that.
        if (this.parameters.variables.length != args.length) throw new Utility.RunTimeError(ErrorCode.WrongNumber)

        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        let child = new Context(context, context.owner)

        for (let i = 0; i < args.length; ++i) {
            const argument = args[i]
            if (argument instanceof NumericExpression) {
                const parameter = this.parameters.variables[i]
                if (parameter instanceof NScalarRef) {
                    parameter.set(child, argument.value(context))
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.InvArg)
                }
            }
            else if (argument instanceof StringExpression) {
                const parameter = this.parameters.variables[i]
                if (parameter instanceof SScalarRef) {
                    parameter.set$(child, argument.value(context))
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.InvArg)
                }
            }
        }

        return child
    }
}

class DefUdfStmtN extends DefUdf {

    protected constructor(name: string,
                          parameters: VariableList,
                          protected readonly expression: NumericExpression) {
        super(name, parameters)
    }

    public static parse(scanner: Scanner) : DefUdfStmtN {

        // Expect DEF FN<id> ( variables ) = numeric expression
        if (!scanner.consumeKeyword("DEF")) return null

        const mark = scanner.mark()

        let name : string
        let parameters : VariableList
        let expression : NumericExpression

        if (scanner.consumeUdfn()) {
            const name = scanner.current().text

            if (scanner.consumeSymbol(TokenType.PAR)
            &&  (parameters = VariableList.parse(scanner))
            &&  scanner.consumeSymbol(TokenType.REN)
            &&  scanner.consumeSymbol(TokenType.EQ)
            &&  (expression = NumericExpression.parse(scanner))) {

                // The parameter names must be unique
                if (VariableList.unique([parameters])) {
                    return new DefUdfStmtN(name, parameters, expression)
                }
                else {
                    throw <DefUdfStmtN>this.fail(scanner, ErrorCode.DupParam, mark)
                }
            }
        }

        throw <DefUdfStmtN>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")=" + this.expression.source()
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): number {
        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        const child = this.setupContext(context, args)

        // Now we evaluate our function expression in that context to get
        // our result
        return this.expression.value(child)
    }
}

class DefUdfStmtS extends DefUdf {

    protected constructor(name: string,
                          parameters: VariableList,
                          protected readonly expression: StringExpression) {
        super(name, parameters)
    }

    public static parse(scanner: Scanner) : DefUdfStmtS {

        // Expect DEF FN<id> ( variables ) = numeric expression
        if (!scanner.consumeKeyword("DEF")) return null

        const mark = scanner.mark()

        let name : string
        let parameters : VariableList
        let expression : StringExpression

        if (scanner.consumeUdfs()) {
            const name = scanner.current().text

            if (scanner.consumeSymbol(TokenType.PAR)
            &&  (parameters = VariableList.parse(scanner))
            &&  scanner.consumeSymbol(TokenType.REN)
            &&  scanner.consumeSymbol(TokenType.EQ)
            &&  (expression = StringExpression.parse(scanner))) {

                // The parameter names must be unique
                if (VariableList.unique([parameters])) {
                    return new DefUdfStmtS(name, parameters, expression)
                }
                else {
                    throw <DefUdfStmtS>this.fail(scanner, ErrorCode.DupParam, mark)
                }
            }
        }

        throw <DefUdfStmtS>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")=" + this.expression.source()
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): string {
        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        const child = this.setupContext(context, args)

        // Now we evaluate our function expression in that context to get
        // our result
        return this.expression.value(child)
    }
}


/*
 lazy val parameter: PackratParser[Either[SScalarRef,NScalarRef]] =
      ( sscalarref ^^ { case s => Left(s)  }
      | nscalarref ^^ { case n => Right(n) }
      )
    lazy val stmt_defnexpn: PackratParser[Statement] =
      "DEF" ~ nudf ~ "(" ~ repsep(parameter, ",") ~ ")" ~ "=" ~ nexpr ^^ {
        case _ ~ id ~ _ ~ args ~ _ ~ _ ~ rv => DefFnExpN(id, args, rv)
      }

    lazy val stmt_defnblkn: PackratParser[Statement] =
      "DEF" ~ nudf ~ "(" ~ repsep(parameter, ",") ~ ")" ~ repsep(parameter, ",") ^^ {
        case _ ~ id ~ _ ~ args ~ _ ~ locals => DefFnBlkN(id, args, locals)
    }

    lazy val stmt_defnexps: PackratParser[Statement] =
      "DEF" ~ sudf ~ "(" ~ repsep(parameter, ",") ~ ")" ~ "=" ~ sexpr ^^ {
        case _ ~ id ~ _ ~ args ~ _ ~ _ ~ rv => DefFnExpS(id, args, rv)
      }

    lazy val stmt_defnblks: PackratParser[Statement] =
      "DEF" ~ sudf ~ "(" ~ repsep(parameter, ",") ~ ")" ~ repsep(parameter, ",") ^^ {
        case _ ~ id ~ _ ~ args ~ _ ~ locals => DefFnBlkS(id, args, locals)
    }

    lazy val stmt_fnend: PackratParser[Statement] = "FNEND" ^^^ Fnend()

    lazy val stmt_fnletn: PackratParser[Statement] =
      nudf ~ "=" ~ nexpr ^^ { case id ~ _ ~ rv => FnLetN(id, rv)}

    lazy val stmt_fnlets: PackratParser[Statement] =
      sudf ~ "=" ~ sexpr ^^ { case id ~ _ ~ rv => FnLetS(id, rv)}
*/