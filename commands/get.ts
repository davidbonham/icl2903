/// <reference path="../basicparser.ts" />
/// <reference path="../errorcode.ts" />

/**
 * Retrieve a file from the file store for this user or the library if the
 * filename is prefixed with a $. Make the file current.
 *
 * The file must be a terminal format file - that is, its type must be B
 * for a BASIC file or D for a text data file. Other format files (C for
 * a compiled file or I for a binary record structured file) cannot be
 * retrieved.
 */
class GetCmd extends Command {

    protected constructor(protected readonly filename: string) {
        super()
    }

    public static parse(scanner: Scanner) : GetCmd {
        return scanner.consumeFilename() ? new GetCmd(scanner.current().text) : null
    }

    protected loadBasic(session: Session.Session, file: string[]) : boolean {

        const parser = new BasicParser
        for (const line of file)
        {
            // Ignore blank lines
            if (line == "") continue

            const node = parser.parse(line)
            if (node == null) {
                session.println("CORRUPT BASIC FILE - PARSE FAILED");
                session.println(ErrorCode.lastError);
            }
            else if (node instanceof LineCmd) {
                node.execute(session)
            }
            else {
                session.println("CORRUPT BASIC FILE - NOT A LINE");
                session.println(ErrorCode.lastError);
                return false;
            }
        }

        return true;
    }

    protected loadTerminalFile(session : Session.Session, file: string[]) : boolean {

        // This is a terminal format file so we build a TextLine node from
        // each line of text
        for (const line of file) {

            // Split the line number from the line
            let p = 0;
            let lineNumberText = "";
            while (Utility.isDigit(line[p])) {
                lineNumberText += line[p]
                p += 1
            }

            const lineNumber = Number.parseInt(lineNumberText)
            if (!lineNumber) {
                session.println("CORRUPT TERMINAL FORMAT FILE - NO  NUMBER")
                session.println(ErrorCode.lastError)
                return false;
            }

            while (Utility.isSpace(line[p])) p += 1
            const record = line.substring(p)
            const statement = TextLineStmt.parse(record)
            session.program.add(lineNumber, new SequenceStmt(statement, null));
        }

        return true;
    }

    public execute(session: Session.Session) : void
    {
        if (this.filename.length > (this.filename[0] == '$' ? 7 : 6)) {
            session.println(ErrorCode.IllegalProgramName)
        }
        else
        {
            // If the filename starts with a $, it means we should look for it in the
            // LIBRY account
            const isLibrary = this.filename[0] == '$'
            const name = isLibrary ? this.filename.slice(1) : this.filename

            if (!session.fileStore.exists(isLibrary, name)) {
                session.println("PROGRAM NOT FOUND")
            }
            else {
                const filetype = session.fileStore.fileInfo(isLibrary, name)["type"]
                if (filetype == "B" || filetype == "D") {

                    const file = session.fileStore.getTerminalFile(isLibrary, name)

                    // Clear the existing program
                    session.program.delete(1, Scanner.MAX_LINE)
                    session.program.name = "";

                    if (filetype == 'B') {
                        this.loadBasic(session, file)
                        session.program.name = name
                        session.program.isData = false;
                    }
                    else {
                        this.loadTerminalFile(session, file)
                        session.program.name = name
                        session.program.isData = true
                    }
                }
                else {
                    session.println("FILE IS OF WRONG TYPE")
                }
            }
        }
    }
}
