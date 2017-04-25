class KillCmd extends Command {

    public constructor(protected readonly filename: string) {
        super()
    }

    public static parse(scanner: Scanner) : KillCmd {

        if (scanner.consumeFilename()) return new KillCmd(scanner.current().text);

        // We don't have a filename but we need to produce the right error
        // message if there's something there. If we are at the end of the
        // line, we failed to parse it:
        if (scanner.atEol()) {
            ErrorCode.set(ErrorCode.CommandNotRecognised)
            return null
        }

        // Otherwise, the argument wasn't a legal filename, which will be
        // discovered when the command is executed.
        return new KillCmd(null)
    }

    public execute(session: Session.Session) : void {
        if (this.filename == null || this.filename.length > (this.filename[0] == '$' ? 7 : 6)) {
            session.println(ErrorCode.IllegalProgramName);
        }
        else {
            const isLibrary = this.filename[0] == "$"
            const filename = isLibrary ? this.filename.substring(1) : this.filename

            const result = session.fileStore.remove(isLibrary, filename)
            if (result) session.println(result)
        }
    }
}
