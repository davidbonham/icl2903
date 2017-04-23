/// <reference path="../ast.ts" />

class ListCmd extends Command {

    public static parse(scanner: Scanner) : ListCmd {
        const range: LineRangeNode = LineRangeNode.parse(scanner)
        return range == undefined ?  new ListCmd(new LineRangeNode(1, Scanner.MAX_LINE)) : new ListCmd(range)
    }

    protected constructor(protected readonly range: LineRangeNode){
       super()
    }

    public execute(session: Session.Session) : void {

        // Interaction with the can't affect the output or state so we
        // can list the entire program and rely on the terminal to
        // discard output when interrupted
        if (session.program.name != undefined) session.println(session.program.name);

        session.program.lines(this.range.from, this.range.to).forEach(
            (statement: Statement, line: number)=> {
                session.println(line.toString() + " " + statement.source())
            }
        )
        session.crlf()
    }

}