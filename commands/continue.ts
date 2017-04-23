class ContinueCmd extends Command {

    protected constructor(protected readonly line: number) {
        super()
    }

    public static parse(scanner: Scanner) : ContinueCmd {

        let line = scanner.consumeLinenumber()
        if (!line) line = 0
        return new ContinueCmd(line);
    }

    public execute(session: Session.Session) {
        // Need zero line to mean continue from next
        session.resume(this.line)
    }
}
