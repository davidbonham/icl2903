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

/**
 * This base class represents the single-line forms of the definition
 * statement. It will be subclassed below for the string and numeric types.
 */
abstract class DefStmt extends Statement {

    protected constructor(protected readonly name: string, protected readonly parameters: VariableList) {
        super()
    }

    public static parse(scanner: Scanner) : DefStmt {

        // Expect DEF FN<id> ( variables ) = expression
        if (!scanner.consumeKeyword("DEF")) return null

        const mark = scanner.mark()

        let name : string
        let parameters : VariableList
        let isString  = false

        if (scanner.consumeUdfn()) {
            name = scanner.current().text
        }
        else if (scanner.consumeUdfs())
        {
            name = scanner.current().text
            isString = true
        }
        else {
            throw <DefStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        // Now we must have a parameter list in parentheses

        if (!(scanner.consumeSymbol(TokenType.PAR)
        &&    (parameters = VariableList.parse(scanner))
        &&     scanner.consumeSymbol(TokenType.REN))) {
            throw <DefStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        if (scanner.consumeSymbol(TokenType.EQ)) {

            // Next, we have an '=' followed by an expression of the
            // correct type. No locals so we can now check that all parameters
            // are unique
            if (!VariableList.unique([parameters])) throw <DefStmt>this.fail(scanner, ErrorCode.DupParam, mark)

            if (isString) {
                const expression = StringExpression.parse(scanner)
                if (!expression) throw <DefStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
                return new DefExpStmtS(name, parameters, expression)
            }
            else {
                const expression = NumericExpression.parse(scanner)
                if (!expression) throw <DefStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
                return new DefExpStmtN(name, parameters, expression)

            }
        }
        else {

            // This is the start of a function definition block so we have
            // an optional list of locals. The locals and parameters must
            // be unique.
            const locals = VariableList.parse(scanner)
            if (!VariableList.unique([parameters, locals])) throw <DefStmt>this.fail(scanner, ErrorCode.DupParam, mark)

            return isString ? new DefBlockStmtS(name, parameters, locals) : new DefBlockStmtN(name, parameters, locals)
        }

    }

    public prepare(context: Context, line: number) {
        context.root().program.declareUdf(this.name, line)
    }

    public execute(context: Context) : boolean {
        return false
    }

    /**
     * To evaluate the body of a function definition, we need to define
     * a local context containing the arguments to the function and any
     * local variables it declares so that references to them don't get
     * looked up in the caller's context. The argument list is a sequence
     * of expressions that must be evaluated in the caller's context and
     * then bound to scalar variables in the local context with the matching
     * argument names. Local variables must be set up to be undefined.
     *
     * @param context   the caller's context
     * @param args      the arguments to the function, as expression trees
     */
    protected setupContext(context: Context, args: (StringExpression|NumericExpression)[]) : Context {

        // We need to check that the right number of arguments have been
        // provided  and that the types match because the parser could
        // not do that.
        if (this.parameters.variables.length != args.length) throw new Utility.RunTimeError(ErrorCode.WrongNumber)

        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        context.pushUDF(12345)

        for (let i = 0; i < args.length; ++i) {
            const argument = args[i]
            if (argument instanceof NumericExpression) {
                const parameter = this.parameters.variables[i]
                if (parameter instanceof NScalarRef) {
                    parameter.set(context, argument.value(context))
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.InvArg)
                }
            }
            else if (argument instanceof StringExpression) {
                const parameter = this.parameters.variables[i]
                if (parameter instanceof SScalarRef) {
                    parameter.set$(context, argument.value(context))
                }
                else {
                    throw new Utility.RunTimeError(ErrorCode.InvArg)
                }
            }
        }

        return context
    }
}

class DefExpStmtN extends DefStmt {

    public constructor(name: string,
                       parameters: VariableList,
                       protected readonly expression: NumericExpression) {
        super(name, parameters)
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

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }
}

class DefExpStmtS extends DefStmt {

    public constructor(name: string,
                       parameters: VariableList,
                       protected readonly expression: StringExpression) {
        super(name, parameters)
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

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }

}

class DefBlockStmtN extends DefStmt {

    protected line: number

    public constructor(name: string,
                       parameters: VariableList,
                       protected readonly locals: VariableList) {
        super(name, parameters)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")" + this.locals.source()
    }

    public prepare(context: Context, line: number) {

        // Check that there is no DEF or END before the next FNEND and that
        // there is an FNEND.
        this.line = context.root().program.findFnend(line)
        context.root().program.declareUdf(this.name, line)
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): number {
        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        const child = this.setupContext(context, args)

        // The legal limits of the statements we can execute as part of
        // the function definition block
        const firstIndex = this.line
        const fnendIndex = child.root().program.findFnend(this.line)

        // Start at the first statement following the DEF and continue
        // executing them until we hit the FNEND or attempt to leave the
        // block.
        child.nextStmtIndex = firstIndex
        while (child.nextStmtIndex != fnendIndex) {

            if (firstIndex <= child.nextStmtIndex && child.nextStmtIndex < fnendIndex) {
                child.root().program.step(child, "")
            }
            else {
                throw new Utility.RunTimeError(ErrorCode.InvExit)
            }
        }

        // We're at the end of the function definition block. Our child
        // context's control stack should be empty with no active FOR or
        // GOSUBs.
        if (child instanceof GosubReturnContext || child instanceof ForNextContext) {
            throw new Utility.RunTimeError(ErrorCode.InvExit)
        }

        // All is well so our result is the current value of our name in
        // the child context
        return child.state().getNumber(this.name)
    }

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }

}

class DefBlockStmtS extends DefStmt {

    public constructor(name: string,
                       parameters: VariableList,
                       protected readonly locals: VariableList) {
        super(name, parameters)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")" + this.locals.source()
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): string {
        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.
        const child = this.setupContext(context, args)
        return ""
    }

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }

}


/*    lazy val stmt_fnend: PackratParser[Statement] = "FNEND" ^^^ Fnend()

    lazy val stmt_fnletn: PackratParser[Statement] =
      nudf ~ "=" ~ nexpr ^^ { case id ~ _ ~ rv => FnLetN(id, rv)}

    lazy val stmt_fnlets: PackratParser[Statement] =
      sudf ~ "=" ~ sexpr ^^ { case id ~ _ ~ rv => FnLetS(id, rv)}
*/