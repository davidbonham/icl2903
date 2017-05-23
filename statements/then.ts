class Then extends Statement {

    public constructor(protected line: number) {
        super()
    }

    public source() : string  {
        // The IF statement deals with the printing of THEN
        return this.line.toString()
    }

    public execute(context: Context) : boolean {
        return false
    }

    public renumber(lineMap: number[]) : void{
        if (this.line in lineMap) this.line = lineMap[this.line]
    }

    public compile(vm: Vm) {
        vm.emit([Op.PUSH, this.line])
        vm.emit1(Op.GO)
    }
}
