/**
 * SCRATCH [name]
 *
 * Delete all the lines from the current BASIC program or terminal format
 * data file. The program becomes unnamed again too.
 *
 * If the optonal name is present, it is equivalent to KILL name
 */
class ScratchCmd extends Command {

    public execute(session: Session.Session) : void {
        session.program.delete(0, Scanner.MAX_LINE)
        session.program.name = ""
    }

    public static parse(scanner: Scanner) : ScratchCmd {
        if (scanner.consumeFilename()) {
            return new KillCmd(scanner.current().text)
        }
        else {
            return new ScratchCmd
        }
    }
}
