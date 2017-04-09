/// <reference path="session.ts" />
/// <reference path="terminal.ts" />

abstract class ASTNode {

}

abstract class Statement extends ASTNode {

}

abstract class Command extends ASTNode {
    public abstract execute(session: Session.Session) : void
}

// ? - Display the full text of the last error message
//
// Some error messages are reported by error number only - I imagine this
// was because the overlay in which they were contained (the command processing
// perhaps) did not have room for the full text. The ? command displays the
// full text corresponding to the error number.
//
// Because the last error is state of the session, this command is never
// executed. Instead the session spots the result of the parse and handles
// it itself.
class QuestionCmd extends Command {
    public  execute(session: Session.Session) : void {}
}

// BYE - log out from BASIC system
//
// Update the account information in the users filespace with the values
// for this session.
//
// The Session object will also spot the BYE command and terminate this
// instance.

class ByeCmd extends Command {
    public  execute(session: Session.Session) : void {

        // Update the user's account for this session
        const elapsedMinutes = session.elapsed();
        /*
        var account = new Account(session.filespace);
        account.update(1, elapsedMinutes, session.mill(), false);
        account.save();
        */

        // Render four digits with leading zeros
        const time = ("0000" + elapsedMinutes).slice(-4)

        // Tell the user they've logged out
        session.println(time + " MINS. TERM. TIME.")
    }
}

class CatalogueCmd extends Command {

    // Convert the file access character into the string we present to the
    // user
    protected static access : {[abbrev:string]: string} = {'U': "USER", 'S': "SHARE", 'R': "READ", 'W': "WRITE", 'X': "RUN"}

    /**
     * The parser will construct a command to execute.
     *
     * @param full      Give full details, one file per line, not brief
     * @param library   Show files in the library, not the user's catalogue
     */
    protected constructor (private full: boolean, private library: boolean) {
        super()
    }

    /**
     * Parse the rest of the command following a CAT or LIB command. We
     * expect an empty line or FULL.
     *
     * @param scanner   Scanner positioned at the end of CAT or LIB
     * @param library   Is this a LIB rather than a CAT?
     */
    public static parse(scanner: Scanner, library: boolean) : CatalogueCmd {
        return new CatalogueCmd(scanner.consumeKeyword("FULL"), library);
    }

    public execute(session: Session.Session,): void {

        // Print the heading required for FULL
        if (this.full) session.println("  NAME     TYPE  DATE LAST USED  NO.BKTS. ACCESS");
        const paths: string[] = session.fileStore.catalogue(this.library);

        if (this.full) {
            this.fullListing(session, paths);
        }
        else {
            this.briefListing(session, paths);
        }
    }

    protected fullListing(session: Session.Session, paths: string[]){

        // We produce a line of output for each file but we don't need to
        // poll the UI to see if we are interrupted as the production of
        // output has no effect on our state and so we can allow the printer
        // to discard extra output after an interrupt.
        for (const path of paths) {

            const info = session.fileStore.fileInfo(this.library, path)

            // Left justify name on field of six spaces
            const name = (info.name + "     ").substring(0,6)

            // Right justify size on a field of four spaces
            const size = ("    " + info.buckets).slice(-4)

            // Decode the access field
            const access = CatalogueCmd.access[info.access]

            session.println(name + "      " + info.type +"       " + info.date + "       " + size + "    " + access)
        }
    }

    protected briefListing(session: Session.Session, paths: string[]) {
        let filesPrinted = 0;
        for(const path of paths) {

            const info = session.fileStore.fileInfo(this.library, path)

            // Left justify name on field of six spaces
            const name = (info.name + "     ").substring(0,6)

            // Print one file name at a time so that the user can break
            // without having to wait to the end
            const output = name + "    " + info.type + "  "
            session.print(output)

            // Print four files per line.
            if (filesPrinted === 4) {
                session.crlf();
                filesPrinted = 0;
            }
            else {
                filesPrinted += 1;
            }
        }

        if (filesPrinted != 0) session.crlf();
        session.crlf();
    }
}

class RunCmd extends Command
{

    protected constructor(protected line: number){
        super()
    }

    public static parse(scanner: Scanner) : RunCmd {
        const line = scanner.consumeLinenumber();
        return line === undefined ? new RunCmd(0) : new RunCmd(line)
    }

    public execute(session: Session.Session) {
        session.run(this.line);
    }
}
