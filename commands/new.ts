/**
 * NEW name
 *
 * This is equivalent to DELETE followed by NAME name.
 */
class NewCmd extends Command {

    protected constructor(protected readonly filename: string) {
        super()
    }

    public static parse(scanner: Scanner) : NewCmd {
        return scanner.consumeFilename() ? new NewCmd(scanner.current().text) : null;
    }

    public execute(session: Session.Session) : void {

        if (this.filename.length < (this.filename[0] == '$' ? 8 : 7)) {
            session.program.delete(1, 9999)
            session.program.name = this.filename
        }
        else {
            session.println(ErrorCode.IllegalProgramName)
        }
    }
}
