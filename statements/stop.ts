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

    public execute(context: Context) : boolean
    {
        // There may be a pending new line on the tty
        const channel = context.owner.channels.get(0)
        if (channel instanceof TerminalChannel) {
            channel.writes("")
            channel.eol()
            throw new Utility.RunTimeError("STOP");
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.BugCheck);
        }

    }

    public compile(vm: Vm) {
        vm.emit1(Op.STOP)
    }
}
