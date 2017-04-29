// APPEND name
//
// Merge the lines from the named file into those already loaded. The result
// takes the name of the appended file. The file to be appended must be of
// the same type as the current content.

class AppendCmd extends FileReadingCommand {

    protected constructor(filename: string) {
        super(filename)
    }

    public static parse(scanner: Scanner) : AppendCmd {
        return scanner.consumeFilename() ? new AppendCmd(scanner.current().text) : null
    }

    public execute(session: Session.Session) : void {

        // Validate the filename and read its contents
        const contents = this.getRecords(session.fileStore)
        if (typeof(contents) == "string") {
            // We were returned an error message
            session.println(contents)
        }
        else  {

            // Make sure the file is the same type as the currently loaded
            // one then load the lines on top of the existing ones.
            if (contents.type == 'B' && !session.program.isData) {
                this.loadBasic(session, contents.contents)
                session.program.name = name
            }
            else if (contents.type == 'D' && session.program.isData) {
                this.loadTerminalFile(session, contents.contents)
                session.program.name = name
            }
            else {
                session.println("FILE IS OF WRONG TYPE")
            }
        }
    }
}
