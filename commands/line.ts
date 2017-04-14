/// <reference path="../ast.ts" />

class LineCmd extends Command
{
    public constructor(protected readonly lineNo: number, protected readonly statement: SequenceStmt){
        super()
    }

    public execute(session: Session.Session) : void {
        session.program.add(this.lineNo, this.statement);
    }
}
