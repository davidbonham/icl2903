/// <reference path="../ast.ts" />

class EndStmt extends Statement {

    public constructor() {
        super()
    }

    public isImmediateStatement() : boolean {
        return false;
    }

    public static parse(scanner: Scanner) : EndStmt {
        return scanner.consumeKeyword("END") ? new EndStmt : null
    }

    public source() : string {
        return "END";
    }

    public compile(vm: Vm) {
        vm.emit1(Op.END)
    }
}
