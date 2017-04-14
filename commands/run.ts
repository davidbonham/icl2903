/// <reference path="../ast.ts" />

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

