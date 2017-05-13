class Then extends Statement {

    public constructor(protected line: number) {
        super()
    }

    public source() : string  {
        // The IF statement deals with the printing of THEN
        return this.line.toString()
    }

    public execute(context: Context) : boolean {
        context.nextStmtIndex = this.line * 100
        return false
    }

    public renumber(lineMap: number[]) : void{
        if (this.line in lineMap) this.line = lineMap[this.line]
    }

    public compile(vm: Vm) {
        vm.emit([Op.GO, this.line])
    }
}
