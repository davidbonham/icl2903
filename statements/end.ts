/// <reference path="../ast.ts" />

class EndStmt extends Statement {

    public isImmediateStatement() : boolean {
        return false;
    }

    public static parse(scanner: Scanner) : Statement {
        return scanner.consumeKeyword("END") ? new EndStmt : null
    }

    public source() : string {
        return "END";
    }

    public execute(context: Context) : boolean {

        // There may be a pending new line on the tty
        context.terminate()

        // Use the error handling mechanism to generate the end message
        throw new Utility.RunTimeError("DONE");
    }
}
