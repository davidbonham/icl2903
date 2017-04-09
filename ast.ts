/// <reference path="session.ts" />
/// <reference path="terminal.ts" />

abstract class ASTNode {

}

class LineRangeNode extends ASTNode
{
    public constructor(public readonly from: number, public readonly to: number) {
        super()
    }

    public static parse(scanner: Scanner) : LineRangeNode {

        // We may consume multiple tokens before we discover we must fail
        // so we'll need to leave the scanner undisturbed in that case.
        const start = scanner.mark();

        const first = scanner.consumeLinenumber()
        if (first != undefined) {

            if (scanner.consumeSymbol(TokenType.COMMA)) {
                const last = scanner.consumeLinenumber()
                if (last !== undefined) {
                    // 100,200
                    return new LineRangeNode(first, last);
                }
                else {
                    // 100,
                    return new LineRangeNode(first, Scanner.MAX_LINE);
                }
            }
            else {
                // 100
                return new LineRangeNode(first, first);
            }
        }
        else if (scanner.consumeSymbol(TokenType.COMMA)) {
            const last = scanner.consumeLinenumber()
            if (last !== undefined) {
                // ,200
                return new LineRangeNode(1, last);
            }
            else {
                // , on its own isn't legal
                scanner.restore(start);
                return null;
            }
        }

        return null;
    }
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

class DeleteCmd extends Command {

    public static parse(scanner: Scanner) : DeleteCmd {

        const range: LineRangeNode = LineRangeNode.parse(scanner);
        if (range === null) {
            return null;
        }

        return new DeleteCmd(range)
    }

    public constructor(protected range: LineRangeNode) {
        super()
    }

    public execute(session: Session.Session) : void {
        session.program.delete(this.range.from, this.range.to);
    }
}

class LineCmd extends Command
{
    public constructor(protected readonly lineNo: number, protected readonly statement: SequenceStmt){
        super()
    }

    public execute(session: Session.Session) : void {
        session.program.add(this.lineNo, this.statement);
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

abstract class Statement extends ASTNode {

    public abstract source() : string
    public abstract execute(context: Context) : boolean

    public isImmediateStatement() : boolean {
        return true;
    }

    public isIfConsequent() {
        return this.isImmediateStatement();
    }

    protected static fail(scanner: Scanner, code: string, mark: number) : Statement {
        //ErrorCode.set(code);
        scanner.restore(mark);
        return null
    }

    // By default, statements have no work to do when they are renumbered.
    // Only statements like GOTO and RESTORE contain line numbers
    public renumber(lineMap: number[]) : void {}

    // By default, there is no preparation to be done for a statement. Only
    // DATA and DIM statements have work to do.
    public prepare(context: Context, line: number) : void {}
}

class SequenceStmt extends Statement
{
    public constructor(public readonly statement: Statement, public readonly next: SequenceStmt) {
        super()
    }

    public  source() : string {
        return this.statement.source() + (this.next != null ? "!" + this.next.source() : "");
    }

    public execute(context: Context) : boolean {

        // In this implementation, we expect to expand sequence statements
        // into the program contents so we never expect to execute
        wto("ERROR: attempt to execute sequence statement")
        return false
        /*
        // Because a statement sequence can contain a loop:
        //    10 PRINT "HELLO"!GOTO 10
        // we need to handle keyboard interrupts. For similar reasons, we also need
        // to spot when we should stop executing the sequence because an earlier
        // statement has branched away from it:
        //    10 A=10!IF A < 10 THEN 20!PRINT "OOPS"
        // should not print OOPS. Handling this is a bit of a fudge at the moment
        // and so
        // FIXME: reworking of branching

        if (context._owner._channels.get(0).interrupt()) {
            context._owner.breakIn();
            return false;
        }
        else {
            //Log.log(Log.Level.INFO, "executing " + _statement.source());
            var carryon = this.statement.execute(context);
            if (carryon)
            {
                // Our statement didn't branch, execute the rest of the
                // statements on the line
                // if (_next != null) Log.log(Log.Level.INFO, "rest of sequence is " + _next.source());
                if (this.next != null)
                    carryon = this.next.execute(context);
            }
            return carryon;
        }
        */
    }

    public prepare(context: Context, line: number) : void {

        // Similarly, we don't execute this either
        wto("ERROR: attempt to prepare sequence statement")
        /*
        _statement.prepare(context, line);
        if (_next != null)
            _next.prepare(context, line);
            */
    }

    public renumber(lineMap: number[]) : void
    {
        this.statement.renumber(lineMap)
        if (this.next != null) {
            this.next.renumber(lineMap)
        }
    }
}

class EndStmt extends Statement {

    public isImmediateStatement() : boolean {
        return false;
    }

    public static parse(scanner: Scanner) : Statement {
        return scanner.consumeKeyword("END") ? new EndStmt : null
    }

    public source() : string {
        return "END";
    }

    public execute(context: Context) : boolean {

        // There may be a pending new line on the tty
        context.terminate()

        // Use the error handling mechanism to generate the end message
        throw new Utility.RunTimeError("DONE");
    }
}
