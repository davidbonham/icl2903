/**
 * SAVE [RUN|SHARE]?
 *
 * There must be a program or data file in memory and it must be named.
 * Save the data to the file store (sessionStorage) which will trigger
 * an attempt to synchronise the file store with the remove server.
 *
 * The file must not already exist in the file store. There must be enough
 * disc quota available.
 */
class SaveCmd extends Command
{
    protected constructor(protected readonly access: string) {
        super()
    }

    public static parse(scanner: Scanner) : SaveCmd {

        // The command may be followed by a single keyword, either RUN
        // or share
        let access = 'U'

        if (scanner.consumeKeyword("RUN")) {
            access = 'X'
        }
        else if (scanner.consumeKeyword("SHARE")) {
            access = 'S'
        }

        return new SaveCmd(access)
    }

    public execute(session: Session.Session) : void {

        if (session.program.name == "") {
            session.println("PROGRAM NOT NAMED")
        }
        else if (session.program.lineCount() == 0) {
            session.println("NO PROGRAM")
        }
        else {

            const mode = session.program.isData ? 'D' : 'B'

            // If this is a BASIC program, the mode must be X, S or U. If it
            // is data, it must me R, W, S or U.
            const permitted = mode == "D" ? "RWSU" : "XSU"
            if (permitted.indexOf(this.access) == -1) {
                session.println("BAD ACCESS MODE!")
            }
            else {
                let source: string[] = []

                // Use forEach to keep the original line numbers
                session.program.lines(1, Scanner.MAX_LINE).forEach((statement: Statement, line: number) => {
                    source.push(line.toString() + " " + statement.source())
                })

                // The file store will complain if the file already exists
                // or saving it will take the user over their disc quota.
                const size = session.program.size()
                const error = session.fileStore.saveTerminalFile(false, session.program.name, mode, this.access, source, size)

                if (error) {
                    session.println(error)
                }
            }
        }
    }
}
