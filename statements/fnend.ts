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

    public compile(vm: Vm) {
        // The user should have set the result of our function name in
        // the context so we need to push it onto the stack before we
        // pop the context.
        vm.emit([Op.UV, Op.UFE])
    }

}
