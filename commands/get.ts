/// <reference path="../basicparser.ts" />
/// <reference path="../errorcode.ts" />

// Several commands manipulate the loaded file by loading another one into
// it: GET, APPEND. Derive them from the following base class:
class FileLoader {

    public constructor(protected readonly session: Session.Session, protected readonly filename: string) {
    }

    public getRecords() : {type: string, contents: string[]} | string {

        if (this.filename.length > (this.filename[0] == '$' ? 7 : 6)) {
             return ErrorCode.IllegalProgramName
        }
        else {
            // If the filename starts with a $, it means we should look for it in the
            // LIBRY account
            const isLibrary = this.filename[0] == '$'
            const name = isLibrary ? this.filename.slice(1) : this.filename

            if (!this.session.fileStore.exists(isLibrary, name)) {
               return "PROGRAM NOT FOUND"
            }
            else {
                const filetype = this.session.fileStore.fileInfo(isLibrary, name)["type"]
                if (filetype == "B" || filetype == "D") {
                    return {type: filetype, contents: this.session.fileStore.getTerminalFile(isLibrary, name)}
                }
                else {
                    return "FILE IS OF WRONG TYPE"
                }
            }
        }
    }

    public loadBasic(file: string[]) : boolean {

        const parser = new BasicParser
        let count = 1
        for (const line of file)
        {
            count += 1
            // Ignore blank lines
            if (line == "") continue

            const node = parser.parse(line)
            if (node == null) {
                this.session.println("CORRUPT BASIC FILE - PARSE FAILED AT LINE " + count);
                this.session.println(ErrorCode.lastError);
            }
            else if (node instanceof LineCmd) {
                node.execute(this.session)
            }
            else {
                this.session.println("CORRUPT BASIC FILE - AT LINE " + count + " " + node);
                this.session.println(line)
                return false;
            }
        }

        return true;
    }

    public loadTerminalFile(file: string[]) : boolean {

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
                this.session.println("CORRUPT TERMINAL FORMAT FILE - NO  NUMBER")
                this.session.println(ErrorCode.lastError)
                return false;
            }

            while (Utility.isSpace(line[p])) p += 1
            const record = line.substring(p)
            const statement = TextLineStmt.parse(record)
            this.session.program.add(lineNumber, new SequenceStmt(statement, null));
        }

        return true;
    }


}
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


    public execute(session: Session.Session) : void
    {
        const loader = new FileLoader(session, this.filename)

        const contents = loader.getRecords()
        if (typeof(contents) == "string") {
            session.println(contents)
        }
        else  {

            // Clear the existing program
            session.program.delete(1, Scanner.MAX_LINE)
            session.program.name = "";

            if (contents.type == 'B') {
                loader.loadBasic(contents.contents)
                session.program.name = this.filename
                session.program.isData = false;
            }
            else {
                loader.loadTerminalFile(contents.contents)
                session.program.name = this.filename
                session.program.isData = true
            }
        }
    }
}
