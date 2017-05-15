enum Op {
    ADD,        // N1 N2        => N1+N2        add
    AN,         // C R          => N,           value of array vector element
    AND,        // L L          => L
    DIV,        // N1 N2        => N1/N2        divide
    DROP,       // V            => ,            drop item on top of stack
    END,        //                              stop execution
    EQ,         // V V          => V == V       test equality
    GE,         // V V          => V >= V       test inequality
    GO,         //              =>              jump to line
    GT,         // V V          => V > V        test inequality
    IMP,        // L L          => L
    INE,        //                              end the current input statement
    INN,        //              => N            input a number
    INR,        //              =>              reset the input buffer
    INS,        //              => S            input s string
    JMP,        //                              jump unconditionally
    JF,         // L            =>
    LE,         // V V          => V <= V       test inequality
    LT,         // V V          => V < V        test inequality
    MAX,        // V V          => V            max of two values
    MIN,        // V V          => V            min of two values
    MUL,        // N1 N2        => N1*N2        multiply
    NEG,        // N            => -N ,         Negate
    NE,         // V V          => V != V       test inequality
    NF,         //              => F(),         apply function to 0 arg
    NFN,        // N            => F(N),        apply function to 1 arg
    NFS,        // S            => F(S),        apply function to 1 arg
    NFSS,       // S1 S2        => F(S1, S2),   apply function to 2 args
    NFSSN,      // S1 S2 N3     => F(S1, S2),   apply function to 3 args
    NOP,
    NOT,        // L            => !L           logical not
    OR,         // L L          => L
    POW,        // N1 N2        => N1^N2        power
    PUSH,
    RDN,        //              => N            read datum ito variable
    RDS,        //              => S            read datum ito variable
    SN,         //              => N            value of numeric scalar
    SUB,        // N1 N2        => N1-N2        subtract
    SAN,        // N C R S      => N,           Set Array Numeric
    SIC,        // N            =>              Set Input Channel
    SOC,        // N            =>              Set Output Channel
    SF,
    SFN,
    SFSN,
    SFSNN,
    SFSS,
    SFSSN,
    SFSSS,
    SSN,        // N S          => N,           Set Scalar Numeric
    SVN,        // N C S        => N,           Set Vector Numeric
    TTB,        //              =>              Begin tty output
    TTC,        //              =>              Tab to next comma column
    TTE,        //              =>              End tty output
    TTF,        // S            =>              Set the current format string
    TTL,        //              =>              Finish the current line
    TTN,        // N            =>              Format the number and print it
    TTS,        // S            =>              Format the string and print it
    TTT,        // N            =>              Tab to tab position
    VN,         // C            => N,           value of numeric vector element
    SSS,
    SVS,
    SAS,
}

type Value = number | string | boolean
type Code = Op | Value | Object


class InputBuffer {

    protected buffer: string
    protected itemsRead: number
    protected tokens: string[]
    protected tokenise: boolean

    protected tokeniseLine()  {
        let tokens: string[] = []
        let quoted = false;
        let current = "";

        for (let ch of this.buffer) {
            // The next token exists and continues up to the next unquoted
            // comma or the end of the line. At the end of the line, we
            // may still be unquoted.
            if (ch == '"') {
                quoted = !quoted;
                current += ch;
            }
            else if (!quoted && ch == ',') {
                tokens.push(current);
                current = "";
            }
            else {
                current += ch;
            }
        }

        // If there is text here, it's the last item on the line
        if (current != "") tokens.push(current);
        wto("tokenised " + tokens)
        return tokens
    }

    public reset(tokenise: boolean) : void {
        this.buffer = ""
        this.itemsRead = 0
        this.tokenise = tokenise
        this.tokens = []
        wto("reset")
    }

    public readNumber(context: Context) : number {
        wto("readNumber tokens=" + this.tokens)
        // We're doing an INPUT not a LINPUT. If we have no tokens, we
        // return null to indicate the vm should break to allow the session
        // to provide a new line of input
        if (this.tokens.length == 0) {
            this.prompt(context)
            wto("readNumber returns null")
            return null
        }

        // The next token should be a number.
        const token = this.tokens.shift()
        const value = parseFloat(token)
        if (Number.isNaN(value)) {
            // This wasn't a number so we discard any remaining input and
            // ask the user to retype the line and get the VM to break
            const line = context.owner.vmLine()
            context.owner.session.println("LINE " + line + " BAD INPUT - RETYPE FROM ITEM " + (this.itemsRead + 1) + "\n")
            this.prompt(context)
            return null
        }

        this.itemsRead++
        wto("readNumber read " + this.itemsRead + " value " + value)
        return value

    }

    public readString(context: Context) : string {

        // We're doing an INPUT not a LINPUT. If we have no tokens, we
        // return null to indicate the vm should break to allow the session
        // to provide a new line of input
        if (this.tokens.length == 0) {
            this.prompt(context)
            return null
        }
        this.itemsRead++
        return this.tokens.shift()

    }

    public readLine(context: Context) : string {

        // We're doing a LINPUT not an INPUT.
        if (this.tokens.length == 0) {
            this.prompt(context)
            return null
        }
        return this.tokens.shift()
    }

    public prime(line: string) : void {
        wto("prime " + line)
        this.buffer = line
        this.tokens = this.tokenise ? this.tokeniseLine() : [line]
    }

    public flush() : boolean {
        wto("flush")
        return this.tokens.length != 0
    }

    protected prompt(context: Context) {
        wto("prompt")
        const tty = context.owner.getInputChannel()
        // Make sure there's a prompt - we know we are interactive
        tty.writes("? ")
        tty.eol()
    }
}

class Vm {

    protected static opmap: ((vm: Vm, context: Context) => void)[] = []

    protected pc : number
    public getPC() : number { return this.pc }

    // The number of operations to perform before returning to the caller
    protected count: number

    protected code: Code[]

    protected valueStack: Value[]

    protected inputBuffer: InputBuffer

    public constructor() {
        Vm.opmap[Op.ADD]    = Vm.ADD
        Vm.opmap[Op.AN]     = Vm.AN
        Vm.opmap[Op.AND]    = Vm.AND
        Vm.opmap[Op.DIV]    = Vm.DIV
        Vm.opmap[Op.DROP]   = Vm.DROP
        Vm.opmap[Op.END]    = Vm.END
        Vm.opmap[Op.EQ]     = Vm.EQ
        Vm.opmap[Op.GE]     = Vm.GE
        Vm.opmap[Op.GO]     = Vm.GO
        Vm.opmap[Op.GT]     = Vm.GT
        Vm.opmap[Op.IMP]    = Vm.IMP
        Vm.opmap[Op.INE]    = Vm.INE
        Vm.opmap[Op.INN]    = Vm.INN
        Vm.opmap[Op.INR]    = Vm.INR
        Vm.opmap[Op.INS]    = Vm.INS
        Vm.opmap[Op.JMP]    = Vm.JMP
        Vm.opmap[Op.JF]     = Vm.JF
        Vm.opmap[Op.LE]     = Vm.LE
        Vm.opmap[Op.LT]     = Vm.LT
        Vm.opmap[Op.MAX]    = Vm.MAX
        Vm.opmap[Op.MIN]    = Vm.MIN
        Vm.opmap[Op.MUL]    = Vm.MUL
        Vm.opmap[Op.NEG]    = Vm.NEG
        Vm.opmap[Op.NE]     = Vm.NE
        Vm.opmap[Op.NF]     = Vm.NF
        Vm.opmap[Op.NFN]    = Vm.NFN
        Vm.opmap[Op.NFS]    = Vm.NFS
        Vm.opmap[Op.NFSS]   = Vm.NFSS
        Vm.opmap[Op.NFSSN]  = Vm.NFSSN
        Vm.opmap[Op.NOP]    = Vm.NOP
        Vm.opmap[Op.NOT]    = Vm.NOT
        Vm.opmap[Op.OR]     = Vm.OR
        Vm.opmap[Op.POW]    = Vm.POW
        Vm.opmap[Op.PUSH]   = Vm.PUSH
        Vm.opmap[Op.RDN]    = Vm.RDN
        Vm.opmap[Op.RDS]    = Vm.RDS
        Vm.opmap[Op.SAN]    = Vm.SAN
        Vm.opmap[Op.SF]     = Vm.SF
        Vm.opmap[Op.SFN]    = Vm.SFN
        Vm.opmap[Op.SFSN]   = Vm.SFSN
        Vm.opmap[Op.SFSNN]  = Vm.SFSNN
        Vm.opmap[Op.SFSS]   = Vm.SFSS
        Vm.opmap[Op.SFSSN]  = Vm.SFSSN
        Vm.opmap[Op.SFSSS]  = Vm.SFSSS
        Vm.opmap[Op.SIC]    = Vm.SIC
        Vm.opmap[Op.SN]     = Vm.SN
        Vm.opmap[Op.SOC]    = Vm.SOC
        Vm.opmap[Op.SSN]    = Vm.SSN
        Vm.opmap[Op.SUB]    = Vm.SUB
        Vm.opmap[Op.SVN]    = Vm.SVN
        Vm.opmap[Op.TTB]    = Vm.TTB
        Vm.opmap[Op.TTC]    = Vm.TTC
        Vm.opmap[Op.TTE]    = Vm.TTE
        Vm.opmap[Op.TTF]    = Vm.TTF
        Vm.opmap[Op.TTL]    = Vm.TTL
        Vm.opmap[Op.TTN]    = Vm.TTN
        Vm.opmap[Op.TTS]    = Vm.TTS
        Vm.opmap[Op.TTT]    = Vm.TTT
        Vm.opmap[Op.VN]     = Vm.VN
        Vm.opmap[Op.SSS]    = Vm.SSS
        Vm.opmap[Op.SVS]    = Vm.SVS
        Vm.opmap[Op.SAS]    = Vm.SAS
    }

    protected bug(reason: string) {
        wto("vm detected bug: " + reason)
        this.dump()
        Utility.bugcheck(reason)
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }

    public dump() {
        wto("== Object Code ==================")
        this.code.forEach((value, index) => {
            const text = typeof(value) == "number" ? Op[value] : "value"
            wto(Utility.padInteger(index, 5, "0") + ": " + value + "(" + text + ")")
        })
        wto("PC=" + this.pc)
        wto("== Value Stack ==================")
        this.valueStack.forEach(value => {
            wto(typeof(value) + ": " + value)
        })
        wto("=================================")
    }
    public clear() : void {
        this.code = []
        this.valueStack = []
        this.inputBuffer = new InputBuffer
    }

    public inputLine(line: string) {
        this.inputBuffer.prime(line)
    }

    public mark(spaces: number) : number {
        const result = this.code.length
        for (let n = 0; n < spaces; ++n) {
            this.code.push(Op.NOP)
        }
        return result
    }

    public patch(at: number, code: Code[]) {
        let patchPos = at
        code.forEach(value => {
            if (this.code[patchPos] != Op.NOP) {
                this.bug("patch at " + at + " with " + code + " overwrites at " + patchPos)
            }
            this.code[patchPos] = value
            patchPos++
        })
    }

    public emit(code: Code[]) : void  {
        code.forEach(value => this.code.push(value))
    }

    public emit1(code: Code) : void  {
        this.code.push(code)
    }

    public goto(pc: number) {
        this.pc = pc
    }

    protected push(value: Code) {
        if (typeof(value) == "number" || typeof(value) == "string" || typeof(value) == "boolean") {
            this.valueStack.push(value)
        }
        else {
            this.bug("vm: attempt to push non-value at pc=" + (this.pc-2))
        }
    }

    public pop() : Value {
        if (this.valueStack.length == 0) this.bug("stack underflow in pop")
        return this.valueStack.pop()
    }

    public popNumber() : number {
        const value = this.pop()
        if (typeof(value) != "number") {
            this.bug("value popped from stack (" + value + ") is not a number")
        }
        else {
            return value
        }
    }

    public peekNumber() : number {
        const value = this.valueStack[this.valueStack.length-1]
        if (typeof(value) != "number") {
            this.bug("value peeked from stack (" + value + ") is not a number")
        }
        else {
            return value
        }
    }

    public peekString() : string {
        const value = this.valueStack[this.valueStack.length-1]
        if (typeof(value) != "string") {
            this.bug("value peeked from stack (" + value + ") is not a string")
        }
        else {
            return value
        }
    }

    public popLogical() : boolean {
        const value = this.pop()
        if (typeof(value) != "boolean") {
            this.bug("value popped from stack (" + value + ") is not a boolean")
        }
        else {
            return value
        }
    }

    public popString() : string {
        const value = this.pop()
        if (typeof(value) != "string") {
            this.bug("value popped from stack (" + value + ") is not a string")
        }
        else {
            return value
        }
    }

    public argN() : number {
        const value = this.code[this.pc++]
        if (typeof(value) != "number") {
            this.bug("argument (" + value + ") is not a number")
        }
        else {
            return value
        }
    }

    public argS() : string {
        const value = this.code[this.pc++]
        if (typeof(value) != "string") {
            this.bug("argument (" + value + ") is not a string")
        }
        else {
            return value
        }
    }

    public binaryOpNN(op : (lhs: number, rhs: number) => number ) {
        const rhs = this.popNumber()
        const lhs = this.popNumber()
        const result = op(lhs, rhs)

        if (Number.isNaN(result)
        ||  !Number.isFinite(result)
        ||  result < -NumericExpression.MAXIMUM
        ||  NumericExpression.MAXIMUM < result) {
            throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)
        }

        this.push(result)
    }

    public logicalOp(op : (lhs: number|string|boolean, rhs: number|string|boolean) => boolean) {
        const rhs = this.pop()
        const lhs = this.pop()
        if (typeof(lhs) != typeof(rhs)) {
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
        this.push(op(lhs, rhs))
    }

    public pcForLine(context: Context, line: number) {
        const pc = context.owner.pcForLine(line)
        if (!pc)throw new Utility.RunTimeError(ErrorCode.CalledLineNot)
        return pc
    }

    protected static ADD(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs + rhs)
    }

    protected static AN(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const row = vm.popNumber()
        const col = vm.popNumber()
        vm.push(NArrayRef.AN(context, id, col, row))

    }
    protected static AND(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs: boolean, rhs: boolean) => lhs && rhs)
    }

    protected static DIV(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs / rhs)
    }

    protected static DROP(vm: Vm, context: Context) : void {
        vm.pop()
    }

    protected static EQ(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs == rhs)
    }

    protected static GE(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs >= rhs)
    }

    protected static GO(vm: Vm, context: Context) : void {
        vm.pc = vm.pcForLine(context, vm.argN())
    }

    protected static GT(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs > rhs)
    }

    protected static IMP(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs: boolean, rhs: boolean) => !lhs || rhs)
    }

    protected static LE(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs <= rhs)
    }

    protected static LT(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs < rhs)
    }

    protected static OR(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs: boolean, rhs: boolean) => lhs || rhs)
    }

    protected static PUSH(vm: Vm, context: Context) : void {
        vm.push(vm.code[vm.pc++])
    }

    protected static END(vm: Vm, context: Context) : void {
        EndStmt.exec()
    }

    /**
     * INput a Number and place it on the stacl
     *
     * Attempt to read a number from the existing contents of the input
     * buffer. If the number cannot be read, we need to interact with the
     * user to get another line. We do this by telling the program we need
     * more input, zeroing our count to exit the execution loop and resetting
     * the PC to its last value so that the next time the VM is entered,
     * this instruction is re-executes, hopefully with a new line of input
     * ready for it.
     *
     * @param vm
     * @param context
     */
    protected static INN(vm: Vm, context: Context) : void {
        const value = vm.inputBuffer.readNumber(context)
        if (!value) {
            // We need to interact with the user and try this operation
            // again.
            vm.count = 0
            vm.pc--
            context.owner.needInput()
        }
        else {
            vm.push(value)
        }
    }

    protected static INS(vm: Vm, context: Context) : void {
        const value = vm.inputBuffer.readString(context)
        if (!value) {
            // We need to interact with the user and try this operation
            // again.
            vm.count = 0
            vm.pc--
            context.owner.needInput()
        }
        else {
            vm.push(value)
        }
    }

    protected static INE(vm: Vm, context: Context) : void {
        if (vm.inputBuffer.flush()) {
            context.owner.session.println("EXTRA INPUT - WARNING ONLY")
        }
    }

    protected static INR(vm: Vm, context: Context) : void {
        vm.inputBuffer.reset(true)
    }

    protected static JMP(vm: Vm, context: Context) : void {
        vm.pc = vm.argN()
    }

    protected static JF(vm: Vm, context: Context) : void {
        const destination = vm.argN()
        if (!vm.popLogical()) vm.pc = destination
    }

    protected static MAX(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs > rhs ? lhs : rhs)
    }

    protected static MIN(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs < rhs ? lhs : rhs)
    }

    protected static MUL(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs * rhs)
    }

    protected static NE(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs != rhs)
    }

    protected static NF(vm: Vm, context: Context) : void {
        const fn : () => number = <() => number>vm.code[vm.pc++]
        const result = fn()
        vm.push(result)
    }

    protected static NEG(vm: Vm, context: Context) : void {
        vm.push(-vm.popNumber())
    }

    protected static NFN(vm: Vm, context: Context) : void {
        const fn : (a: number) => number = <(a: number) => number>vm.code[vm.pc++]
        const a : number = vm.popNumber()
        const result = fn(a)
        vm.push(result)
    }

    protected static NFS(vm: Vm, context: Context) : void {
        const fs : (a: string) => number = <(a: string) => number>vm.code[vm.pc++]
        const a : string = vm.popString()
        const result = fs(a)
        vm.push(result)
    }

    protected static NFSS(vm: Vm, context: Context) : void {
        const fss : (a: string, b: string) => number = <(a: string, b: string) => number>vm.code[vm.pc++]
        const b : string = vm.popString()
        const a : string = vm.popString()
        const result = fss(a, b)
        vm.push(result)
    }

    protected static NFSSN(vm: Vm, context: Context) : void {
        const fssn : (a: string, b: string, c: number) => number = <(a: string, b: string, c: number) => number>vm.code[vm.pc++]
        const c : number = vm.popNumber()
        const b : string = vm.popString()
        const a : string = vm.popString()
        const result = fssn(a, b, c)
        vm.push(result)
    }

    /**
     * No OPeration
     *
     * NOPs are used as placeholders in the object code when we know we
     * will need to patch them later on (for example, with the destination
     * address of a branch). If we encounter one during execution, it means
     * something has gone wrong during compilation.
     *
     * @param vm
     * @param context
     */
    protected static NOP(vm: Vm, context: Context) : void {
        vm.bug("NOP encounted => incomplete patch")
    }
    protected static NOT(vm: Vm, context: Context) : void {
        vm.push(!vm.popLogical())
    }

    protected static POW(vm: Vm, context: Context) : void {
        vm.binaryOpNN(Math.pow)
    }

    protected static RDN(vm: Vm, context: Context) : void {
        vm.push(context.data.readNumber())
    }

    protected static RDS(vm: Vm, context: Context) : void {

        vm.push(context.data.readString())
    }

    protected static SAN(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const row = vm.popNumber()
        const col = vm.popNumber()
        const value = vm.peekNumber()
        NArrayRef.SAN(context, id, col, row, value)
    }

    protected static SAS(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const row = vm.popNumber()
        const col = vm.popNumber()
        const value = vm.peekString()
        SArrayRef.SAS(context, id, col, row, value)
    }

    protected static SF(vm: Vm, context: Context) : void {
        const f : () => string = <() => string>vm.code[vm.pc++]
        const result = f()
        vm.push(result)
    }

    protected static SFN(vm: Vm, context: Context) : void {
        const fn : (a: number) => string = <(a: number) => string>vm.code[vm.pc++]
        const a : number = vm.popNumber()
        const result = fn(a)
        vm.push(result)
    }

    protected static SFSN(vm: Vm, context: Context) : void {
        const fsn : (a: string, b: number) => string = <(a: string, b: number) => string>vm.code[vm.pc++]
        const b : number = vm.popNumber()
        const a : string = vm.popString()
        const result = fsn(a, b)
        vm.push(result)
    }

    protected static SFSNN(vm: Vm, context: Context) : void {
        const fsnn : (a: string, b: number, c: number) => string = <(a: string, b: number, c: number) => string>vm.code[vm.pc++]
        const c : number = vm.popNumber()
        const b : number = vm.popNumber()
        const a : string = vm.popString()
        const result = fsnn(a, b, c)
        vm.push(result)
    }

    protected static SFSSN(vm: Vm, context: Context) : void {
        const fssn : (a: string, b: string, c: number) => string = <(a: string, b: string, c: number) => string>vm.code[vm.pc++]
        const c : number = vm.popNumber()
        const b : string = vm.popString()
        const a : string = vm.popString()
        const result = fssn(a, b, c)
        vm.push(result)
    }

    protected static SFSS(vm: Vm, context: Context) : void {
        const fss : (a: string, b: string) => string = <(a: string, b: string) => string>vm.code[vm.pc++]
        const b : string = vm.popString()
        const a : string = vm.popString()
        const result = fss(a, b)
        vm.push(result)
    }

    protected static SFSSS(vm: Vm, context: Context) : void {
        const fsss : (a: string, b: string, c: string) => string = <(a: string, b: string, c: string) => string>vm.code[vm.pc++]
        const c : string = vm.popString()
        const b : string = vm.popString()
        const a : string = vm.popString()
        const result = fsss(a, b, c)
        vm.push(result)
    }

    protected static SIC(vm: Vm, context: Context) : void {
        InputStmt.SIC(context, vm.popNumber())
    }

    protected static SN(vm: Vm, context: Context) : void {
        vm.push(NScalarRef.SN(context, vm.argS()))
    }

    protected static SOC(vm: Vm, context: Context) : void {
        PrintStmt.SOC(context, vm.popNumber())
    }

    protected static SSN(vm: Vm, context: Context) : void {
        NScalarRef.SSN(context, vm.argS(), vm.peekNumber())
    }

    protected static SSS(vm: Vm, context: Context) : void {
        SScalarRef.SSS(context, vm.argS(), vm.peekString())
    }

    protected static SVS(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const col = vm.popNumber()
        const value = vm.peekString()
        SVectorRef.SVS(context, id, col, value)
    }

    protected static SUB(vm: Vm, context: Context) : void {
        vm.binaryOpNN((lhs, rhs) => lhs - rhs)
    }

    protected static SVN(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const col = vm.popNumber()
        const value = vm.peekNumber()
        NVectorRef.SVN(context, id, col, value)
    }


    protected static TTB(vm: Vm, context: Context) : void {
        PrintStmt.TTB(context)
    }

    protected static TTC(vm: Vm, context: Context) : void {
        PrintStmt.TTC(context)
    }

    protected static TTE(vm: Vm, context: Context) : void {
        PrintStmt.TTE(context)

        // Make sure we display the output and give the user an opportunity
        // to break in
        vm.count = 0
    }

    protected static TTF(vm: Vm, context: Context) : void {
        PrintStmt.TTF(context, vm.popString())
    }

    protected static TTL(vm: Vm, context: Context) : void {
        PrintStmt.TTL(context)
    }

    protected static TTN(vm: Vm, context: Context) : void {
        PrintStmt.TTN(context, vm.popNumber())
    }

    protected static TTS(vm: Vm, context: Context) : void {
        PrintStmt.TTS(context, vm.popString())
    }

    protected static TTT(vm: Vm, context: Context) : void {
        PrintStmt.TTT(context, vm.popNumber())
    }

    protected static VN(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const col = vm.popNumber()
        vm.push(NVectorRef.VN(context, id, col))
    }

    public step(count: number, context: Context) {
        this.count = count

        while (this.count-- > 0) {
            //this.dump()
            const op = this.code[this.pc++]
            if (typeof(op) == "number" && Vm.opmap[op]) {
                Vm.opmap[op](this, context)
            }
            else {
                this.bug("undefined operation " + op + " at pc " + (this.pc-1))
            }
        }
    }
}