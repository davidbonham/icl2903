// When a terminal format file is loaded via GET, each line of text is
// represented by a TextLine statement
class TextLineStmt extends Statement {


    protected constructor(protected readonly data: string) {
        super()
    }

    public  source(): string {
        return this.data
    }

    // We should never attempt to execute lines in a terminal format file
    public execute(context: Context) : boolean {
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }

    public static parse(line: string) : TextLineStmt {
        return new TextLineStmt(line)
    }
}
