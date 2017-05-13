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

    public execute(context: Context) : boolean {

        // There may be a pending new line on the tty but the session
        // will close all of the channels before it reports the DONE

        // Use the error handling mechanism to generate the end message
        throw new Utility.RunTimeError("DONE");
    }

    public compile(vm: Vm) {
        vm.emit1(Op.END)
    }

    public static exec() {
        throw new Utility.RunTimeError("DONE");
    }
}
