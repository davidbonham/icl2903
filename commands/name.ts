/// <reference path="../ast.ts" />

class NameCmd extends Command {

    protected constructor(protected readonly filename: string){
        super()
    }

    public static parse(scanner: Scanner) : NameCmd {
        return scanner.consumeFilename() ? new NameCmd(scanner.current().text) : null;
    }

    public execute(session: Session.Session) : void {
        session.program.name = this.filename;
    }
}
