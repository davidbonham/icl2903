class NextStmt extends Statement {


    public isImmediateStatement() : boolean {
        return false
    }

    public source() : string {
        return "NEXT " + this.index.source()
    }

    protected constructor(public readonly index: NScalarRef) {
        super()
    }

    public static parse(scanner: Scanner) : NextStmt {

        const mark = scanner.mark()

        if (scanner.consumeKeyword("NEXT")) {
            const index = NRef.parse(scanner)
            if (index) {
                // Check that the loop index is a scalar
                if (index instanceof NScalarRef) {
                    return new NextStmt(index)
                }
            }

            return <NextStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }
        else {
            return null
        }
    }

    public compile(vm: Vm) {
        vm.emit([Op.NXT, this.index])
    }
}
