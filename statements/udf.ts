class UdfNStmt extends Statement {

    protected constructor(protected readonly name: string, protected readonly expression: NumericExpression) {
        super()
    }

    public static parse(scanner: Scanner) : UdfNStmt {

        const mark = scanner.mark()

        // Syntax is much simpler than for a LET statement as we just
        // have the name of a UDF , =, expression
        if (scanner.consumeUdfn()) {

            const name = scanner.current().text
            if (scanner.consumeSymbol(TokenType.EQ)) {
                const expression = NumericExpression.parse(scanner)
                if (expression) return new UdfNStmt(name, expression)
            }

            return <UdfNStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

    }

    public source() : string {
        return this.name + "=" + this.expression.source()
    }

    public compile(vm: Vm) {
        this.expression.compile(vm)
        vm.emit([Op.UNS, this.name])
    }

}

class UdfSStmt extends Statement {

    protected constructor(protected readonly name: string, protected readonly expression: StringExpression) {
        super()
    }

    public static parse(scanner: Scanner) : UdfSStmt {

        const mark = scanner.mark()

        // Syntax is much simpler than for a LET statement as we just
        // have the name of a UDF , =, expression
        if (scanner.consumeUdfn()) {

            const name = scanner.current().text
            if (scanner.consumeSymbol(TokenType.EQ)) {
                const expression = StringExpression.parse(scanner)
                if (expression) return new UdfSStmt(name, expression)
            }

            return <UdfSStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }
    }

    public source() : string {
        return this.name + "=" + this.expression.source()
    }

    public compile(vm: Vm) {
        this.expression.compile(vm)
        vm.emit([Op.USS, this.name])
    }
}