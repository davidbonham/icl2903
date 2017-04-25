class RestoreStmt extends Statement {

    protected constructor(protected lineNumber: number){
        super()
    }

    // The RESTORE statement has an optional line number

    public static parse(scanner: Scanner) : RestoreStmt {

        if (!scanner.consumeKeyword("RESTORE")) return null

        const line = scanner.consumeLinenumber()
        return new RestoreStmt(line ? line : -1)
    }

    public source() : string {
        return "RESTORE " + (this.lineNumber < 0 ? "" : this.lineNumber)
    }

    public execute(context: Context) : boolean {
        context.data.restore(this.lineNumber)
        return false
    }

    public renumber(lineMap: number[]) : void {
        if (this.lineNumber in lineMap) this.lineNumber = lineMap[this.lineNumber]
    }
}
