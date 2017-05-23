class ForStmt extends Statement {

    public isImmediateStatement() : boolean {
        return false
    }

    public source() : string {
        return "FOR " + this.index.source() +
               "="    + this.from.source() +
               " TO " + this.to.source()
               + (this.step == null ? "" : " STEP " + this.step.source())
    }

    public execute(context: Context) : boolean {
        return false;
    }

    protected constructor(protected index: NScalarRef,
                          protected readonly from: NumericExpression,
                          protected readonly to: NumericExpression,
                          protected readonly step: NumericExpression) {
        super()
    }

    public static parse(scanner: Scanner) : ForStmt {

        const mark = scanner.mark()

        if (scanner.consumeKeyword("FOR")) {

            let index : NRef
            let from: NumericExpression
            let to: NumericExpression

            if ((index = NRef.parse(scanner))
            &&  scanner.consumeSymbol(TokenType.EQ)
            &&  (from = NumericExpression.parse(scanner))
            &&  scanner.consumeKeyword("TO")
            &&  (to = NumericExpression.parse(scanner))) {

                // Check that the loop index is a scalar
                if (!(index instanceof NScalarRef)) {
                    return <ForStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
                }

                // Optional step?
                let step: NumericExpression
                if (scanner.consumeKeyword("STEP")
                &&  (step = NumericExpression.parse(scanner))) {
                    return new ForStmt(index, from, to, step)
                }
                else {
                    return new ForStmt(index, from, to, null)
                }
            }
        }

        return null
    }

    public compile(vm: Vm) {

        // Stack the start and finish
        this.from.compile(vm)
        this.to.compile(vm)

        // Stack the step, defaulting to 1
        if (this.step) {
            this.step.compile(vm)
        }
        else {
            vm.emit([Op.PUSH, 1])
        }

        // Specify the loop control variable in the FOR
        vm.emit([Op.FOR, this.index])

        // Space for an unconditional branch to the matching next which
        // will be patched when we prepare to execute
        vm.emit([Op.NOP, Op.NOP])
    }
}
