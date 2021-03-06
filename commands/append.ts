// APPEND name
//
// Merge the lines from the named file into those already loaded. The result
// takes the name of the appended file. The file to be appended must be of
// the same type as the current content.

class AppendCmd extends Command {

    protected constructor(protected readonly filename: string) {
        super()
    }

    public static parse(scanner: Scanner) : AppendCmd {
        return scanner.consumeFilename() ? new AppendCmd(scanner.current().text) : null
    }

    public execute(session: Session.Session) : void {

        // Validate the filename and read its contents
        const loader = new FileLoader(session, this.filename)
        const contents = loader.getRecords()
        if (typeof(contents) == "string") {
            // We were returned an error message
            session.println(contents)
        }
        else  {

            // Make sure the file is the same type as the currently loaded
            // one then load the lines on top of the existing ones.
            if (contents.type == 'B' && !session.program.isData) {
                loader.loadBasic(contents.contents)
                session.program.name = name
            }
            else if (contents.type == 'D' && session.program.isData) {
                loader.loadTerminalFile(contents.contents)
                session.program.name = name
            }
            else {
                session.println("FILE IS OF WRONG TYPE")
            }
        }
    }
}
