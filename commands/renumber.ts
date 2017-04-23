/**
 * RENUMBER, RESEQUENCE - renumber the lines in the BASIC program or terminal
 * format file.
 *
 * For BASIC programs, this takes account of line numbers specified as
 * branch destinations too. The bulk of the work is done by the program
 * class itself, which understands the meanings of statements.
 *
 * RENUMBER 100         Start numbering from 100 with increments of 10
 * RENUMBER 100,50      Start numbering from 100 with increments of 50
 */
class RenumberCmd extends Command {

    public constructor(protected readonly start: number, protected readonly step: number) {
        super()
    }

    public static parse(scanner: Scanner) : RenumberCmd {
        // The default start and step values
        let start = scanner.consumeLinenumber()
        let step: number

        if (start) {
            // Given a start, we can now have an optional , step
            if (scanner.consumeSymbol(TokenType.COMMA)) {
                // Saw comma, must have a step
                step = scanner.consumeLinenumber()
                if (!step) {
                    return null
                }
            }
            else {
                // No step specified
                step = 10;
            }
        }
        else {
            // Neither specified
            start = 10
            step = 10
        }
        return new RenumberCmd(start, step);
    }

    public execute(session: Session.Session) : void {
        session.program.renumber(this.start, this.step);
    }
}
