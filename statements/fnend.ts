class FnendStmt extends Statement {

    public static parse(scanner: Scanner) : ReturnStmt {
        if (scanner.consumeKeyword("FNEND")) {
            return new FnendStmt
        }
        return null
    }

    public source() : string {
        return "FNEND"
    }

    public execute(context: Context) : boolean {
        // We should never attempt to execute this statement. If we do,
        // we must have branched here
        throw new Utility.RunTimeError(ErrorCode.FnendNotinUdf)
    }

    public compile(vm: Vm) {
        Utility.bugcheck("unimplemented")
    }

}
