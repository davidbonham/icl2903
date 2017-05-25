/**
 * STOP
 *
 * Stop execution now with the message "LINE nnnn STOP". Need to deal
 * with pending output.
 */
class StopStmt extends Statement
{
    public static parse(scanner: Scanner) : StopStmt {
        return scanner.consumeKeyword("STOP") ? new StopStmt : null
    }

    public source() : string {
        return "STOP";
    }

    public compile(vm: Vm) {
        vm.emit1(Op.STOP)
    }
}
