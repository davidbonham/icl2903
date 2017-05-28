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

    public signature() : string {
        return this.variables.map(v => v instanceof NScalarRef ? "N" : "S").join()
    }

    public source() : string {
        return this.variables.map(v => v.source()).join(",")
    }

    public bind(args: (number|string)[], context: StateContext) {
        for (let i = 0; i < args.length; ++i) {
            if (this.variables[i] instanceof NScalarRef) {
                context.setScalar(this.variables[i].source(), <number>args[i])
            }
            else {
                context.set$(this.variables[i].source(), <string>args[i])
            }
        }
    }
}

/**
 * This base class represents the single-line forms of the definition
 * statement. It will be subclassed below for the string and numeric types.
 */
abstract class DefStmt extends Statement {

    // Line number of the start of the definition
    protected line: number
    // Line number of the FNEND
    protected fnend: number

    public signature() : string {
        return this.parameters.signature()
    }

    protected constructor(protected readonly name: string, protected readonly parameters: VariableList) {
        super()
        this.line = 0
        this.fnend = 0
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

    public compileEntry (vm: Vm) {

        // We need to leave space for a branch around this function definition
        // in case execution of the main program reaches this point
        vm.emit([Op.DEF, Op.NOP])
    }

    public prepare(context: Context, line: number) {
        context.root().program.declareUdf(this.name, line, this)
    }

    public bind(args: (number|string)[], context: StateContext) : void {
        this.parameters.bind(args, context)
    }
}

abstract class DefExpStmt extends DefStmt {

    public constructor(name: string, parameters: VariableList, protected readonly expression: Expression) {
        super(name, parameters)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")=" + this.expression.source()
    }

    public compile(vm: Vm) {

        this.compileEntry(vm)

         // Compile the code to evaluate the expression assuming that a context
        // has been set up containing the arguments. Leave the result on the
        // stack
        this.expression.compile(vm)
        vm.emit1(Op.UFE)
    }
}

class DefExpStmtN extends DefExpStmt {

    public constructor(name: string, parameters: VariableList, protected readonly expression: NumericExpression) {
        super(name, parameters, expression)
    }
}

class DefExpStmtS extends DefExpStmt {

    public constructor(name: string, parameters: VariableList, protected readonly expression: StringExpression) {
        super(name, parameters, expression)
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): string {
        // Create a new child context in which we will bind our parameters to the
        // values of the argument expression.

        // Now we evaluate our function expression in that context to get
        // our result
        return ""
    }
}

abstract class DefBlockStmt extends DefStmt {

    protected constructor(name: string,
                       parameters: VariableList,
                       protected readonly locals: VariableList) {
        super(name, parameters)
    }

    public source() : string {
        return "DEF " + this.name + "(" + this.parameters.source() + ")" + this.locals.source()
    }

    public prepare(context: Context, line: number) {
        context.root().program.declareUdf(this.name, line, this)
    }

    public compile(vm: Vm) {
        this.compileEntry(vm)
    }
 }

class DefBlockStmtN extends DefBlockStmt {

    public constructor(name: string, parameters: VariableList, locals: VariableList) {
        super(name, parameters, locals)
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): number {
        return 1
    }
}

class DefBlockStmtS extends DefBlockStmt {

    public constructor(name: string, parameters: VariableList, locals: VariableList) {
        super(name, parameters, locals)
    }

    public call(context: Context, args: (StringExpression|NumericExpression)[]): string {
        return ""
    }

}