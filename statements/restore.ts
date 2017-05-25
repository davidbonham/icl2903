/**
 * RESTORE [lineno]
 *
 * Reposition the pointer to data in DATA statements so that the next item
 * read by a READ comes from the first DATA statement on or after line
 * <lineno> of the program. If <lineno> is not specified, the default value
 * is 1.
 */
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

    public renumber(lineMap: number[]) : void {
        if (this.lineNumber in lineMap) this.lineNumber = lineMap[this.lineNumber]
    }

    public compile(vm: Vm) {
        vm.emit([Op.RST, this.lineNumber])
    }
}
