class ReturnStmt extends Statement {

    public static parse(scanner: Scanner) : ReturnStmt {
        if (scanner.consumeKeyword("RETURN")) {
            return new ReturnStmt
        }
        return null
    }

    public source() : string {
        return "RETURN"
    }

    public execute(context: Context) : boolean {
        context.controlstack.doReturn()
        return false
    }

    public compile(vm: Vm) {
        vm.emit1(Op.RET)
    }
}
