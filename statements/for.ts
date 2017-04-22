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

        // Evaluate the loop bounds and set the loop control variable to its initial
        // value then push the NEXT record onto the context's control stack.
        const fromValue = this.from.value(context)
        const toValue = this.to.value(context)
        const stepValue = this.step == null ? 1.0 : this.step.value(context)

        // Set up the control data so that it needs to be stepped to be ready for
        // the first iteration
        this.index.set(context, fromValue - stepValue)

        // Put the control data where the NEXT statement will find it
        context.controlstack.doFor(this.index, toValue, stepValue)

        // Search forward for the next NEXT statement (which must have the same loop
        // control variable) and branch to it.
        context.nextStmtIndex = context.owner.findNext(context.stmtIndex, this.index)
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
}
