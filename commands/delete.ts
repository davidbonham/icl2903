/// <reference path="../ast.ts" />

/**
 * DELETE command
 *
 * Delete lines in the program or terminal format file.
 *
 * DELETE           deletes lines 1-9999
 * DELETE 5         deletes line 5
 * DELETE 5,10      deletes lines 5-10
 * DELETE 5,        deletes line 5-9999
 * DELETE ,5        deletes lines 1-5
 *
 * All of the parsing work is handled by the line range parser which
 * expands the optional range into the limits.
 */
class DeleteCmd extends Command {

    public static parse(scanner: Scanner) : DeleteCmd {

        let range: LineRangeNode = LineRangeNode.parse(scanner);
        if (range === null) {
            range = new LineRangeNode(1,Scanner.MAX_LINE)
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
