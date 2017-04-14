/// <reference path="../ast.ts" />

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
