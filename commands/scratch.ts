/**
 * SCRATCH
 *
 * Delete all the lines from the current BASIC program or terminal format
 * data file. The program becomes unnamed again too.
 */
class ScratchCmd extends Command {

    public execute(session: Session.Session) : void {
        session.program.delete(0, Scanner.MAX_LINE)
        session.program.name = null
    }

    public static parse(scanner: Scanner) : ScratchCmd {
        return new ScratchCmd
    }
}
