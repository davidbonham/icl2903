/**
 * REM rest of line
 *
 * Comment until the end of the line, so for example
 *
 * 500 PRINT 1!REM THIS !PRINT 2 IS ALL A REMARK
 *
 * only prints 1
 */
class RemStmt extends Statement {

    public isImmediateStatement() : boolean {
        return false
    }

    public source() : string {
        return this.rest
    }

    public execute(context: Context) : boolean {
        return false
    }

    protected constructor(protected readonly rest: string){
        super()
    }

    public static parse(scanner: Scanner) : RemStmt
    {
        if (scanner.consumeRemark()) {
            return new RemStmt(scanner.current().text)
        }

        return null
    }

    public compile(vm: Vm) {
        // No effect
    }
}

