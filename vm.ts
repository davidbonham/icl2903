// To allow us to walk through the object code, the operations are endocde in the
// bottom eight bits and the number of operands in the top eight so that most
// operations with no operands are simple
enum Op {
    // Zero operands
    ADD,        // N1 N2        => N1+N2        add
    AND,        // L L          => L
    CALL,       // L            =>              gosub to line L
    CHN,        // S N          =>              chain to a program
    DIV,        // N1 N2        => N1/N2        divide
    DROP,       // V            => ,            drop item on top of stack
    EIS,        //                              end immediate statement
    END,        //                              stop execution
    EQ,         // V V          => V == V       test equality
    GE,         // V V          => V >= V       test inequality
    GO,         // L            =>              jump to line L
    GT,         // V V          => V > V        test inequality
    IMP,        // L L          => L
    INE,        //                              end the current input statement
    INN,        //              => N            input a number
    INR,        //              =>              reset the input buffer
    INS,        //              => S            input s string
    LE,         // V V          => V <= V       test inequality
    LIR,        //                              reset input buffer for LINPUT
    LT,         // V V          => V < V        test inequality
    MAX,        // V V          => V            max of two values
    MIN,        // V V          => V            min of two values
    MRG,        // N N          =>              set the margin for a channel
    MUL,        // N1 N2        => N1*N2        multiply
    NEG,        // N            => -N ,         Negate
    NE,         // V V          => V != V       test inequality
    NOP,
    NOT,        // L            => !L           logical not
    OR,         // L L          => L
    POW,        // N1 N2        => N1^N2        power
    RDN,        //              => N            read datum ito variable
    RDS,        //              => S            read datum ito variable
    RET,        //                              return from gosub
    SC,         // S1 S2        => S            string concatenation
    STOP,       //                              STOP
    SUB,        // N1 N2        => N1-N2        subtract
    SIC,        // N            =>              Set Input Channel
    SOC,        // N            =>              Set Output Channel
    TTB,        //              =>              Begin tty output
    TTC,        //              =>              Tab to next comma column
    TTE,        //              =>              End tty output
    TTF,        // S            =>              Set the current format string
    TTL,        //              =>              Finish the current line
    TTN,        // N            =>              Format the number and print it
    TTS,        // S            =>              Format the string and print it
    TTT,        // N            =>              Tab to tab position
    UFE,        // V            => V            Exit from a UDF
    UV,          //              => V            Push the result of this UDF

    // One Operand
    AN = 0x100, // C R          => N,           value of numeric array element
    AS,         // C R          => S            value of string array element
    CVS,        //              => S            build string from vector and push
    CSV,        // S            =>              place string in vector
    DEF,        //                              entry point to a UDF
    ERR,        //                              throw the error
    FOR,        // V V V        =>              push a FOR onto the control stack
    JF,         // L            =>
    JMP,        //                              jump unconditionally
    NF,         //              => F(),         apply function to 0 arg
    NFN,        // N            => F(N),        apply function to 1 arg
    NFS,        // S            => F(S),        apply function to 1 arg
    NFSS,       // S1 S2        => F(S1, S2),   apply function to 2 args
    NFSSN,      // S1 S2 N3     => F(S1, S2),   apply function to 3 args
    NTH,        // V1..Vn K     => Vk           select nth or -1
    NXT,        //                              End matching FOR loop
    PUSH,
    RST,        //                              restore
    SF,
    SFN,
    SFSN,
    SFSNN,
    SFSS,
    SFSSN,
    SFSSS,
    SVN,        // N C          => N,           Set Vector Numeric
    SAN,        // N C R        => N,           Set Array Numeric
    SSN,        // N            => N            Set Scalar Numeric
    SN,         //              => N            value of numeric scalar
    VN,         // C            => N,           value of numeric vector element
    SSS,        // S            => S            set string scalar
    SVS,        // S C          => S            set string vector element
    SAS,        // S C R        => S            set string array element
    SS,         //              => S            value of string scalar
    UNC,        // V1..VN N     => N            call a user defined numeric function
    UNS,        // N            =>              set result of user defined numeric function
    USC,        // V1..VN N     => S            call a user defined string function
    USS,        // S            =>              set result of user defined string function
    VS,         // C            => S            value of string vector element
}

type Value = number | string | boolean
type Code = any


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
        return tokens
    }

    public reset(tokenise: boolean) : void {
        this.buffer = ""
        this.itemsRead = 0
        this.tokenise = tokenise
        this.tokens = []
    }

    public readNumber(context: Context) : number {
        // We're doing an INPUT not a LINPUT. If we have no tokens, we
        // return null to indicate the vm should break to allow the session
        // to provide a new line of input
        if (this.tokens.length == 0) {
            this.prompt(context)
            return null
        }

        // The next token should be a number.
        const token = this.tokens.shift()
        const value = parseFloat(token)
        if (Number.isNaN(value)) {
            // This wasn't a number so we discard any remaining input and
            // ask the user to retype the line and get the VM to break
            const line = context.root().program.vmLine()
            context.root().session.println("LINE " + line + " BAD INPUT - RETYPE FROM ITEM " + (this.itemsRead + 1) + "\n")
            this.prompt(context)
            return null
        }

        this.itemsRead++
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
        const item = this.tokens.shift()
        return item
    }

    public prime(line: string) : void {
        this.buffer = line
        this.tokens = this.tokenise ? this.tokeniseLine() : [line]
    }

    public flush() : boolean {
        return this.tokens.length != 0
    }

    protected prompt(context: Context) {
        const tty = context.root().getInputChannel()
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

    // The object code
    protected code: Code[]

    // The zones into which the program is divided by function definition
    // blocks - the index is the pc of the DEF, the value the index of the
    // FNEND
    protected zone: number[]

    protected valueStack: Value[]

    protected inputBuffer: InputBuffer

    public constructor() {
        Vm.opmap[Op.ADD]    = Vm.ADD
        Vm.opmap[Op.AN]     = Vm.AN
        Vm.opmap[Op.AND]    = Vm.AND
        Vm.opmap[Op.AS]     = Vm.AS
        Vm.opmap[Op.CALL]   = Vm.CALL
        Vm.opmap[Op.CHN]    = Vm.CHN
        Vm.opmap[Op.CSV]    = Vm.CSV
        Vm.opmap[Op.CVS]    = Vm.CVS
        Vm.opmap[Op.DEF]    = Vm.DEF
        Vm.opmap[Op.DIV]    = Vm.DIV
        Vm.opmap[Op.DROP]   = Vm.DROP
        Vm.opmap[Op.EIS]    = Vm.EIS
        Vm.opmap[Op.END]    = Vm.END
        Vm.opmap[Op.EQ]     = Vm.EQ
        Vm.opmap[Op.ERR]    = Vm.ERR
        Vm.opmap[Op.FOR]    = Vm.FOR
        Vm.opmap[Op.GE]     = Vm.GE
        Vm.opmap[Op.GO]     = Vm.GO
        Vm.opmap[Op.GT]     = Vm.GT
        Vm.opmap[Op.IMP]    = Vm.IMP
        Vm.opmap[Op.INE]    = Vm.INE
        Vm.opmap[Op.INN]    = Vm.INN
        Vm.opmap[Op.INR]    = Vm.INR
        Vm.opmap[Op.INS]    = Vm.INS
        Vm.opmap[Op.JF]     = Vm.JF
        Vm.opmap[Op.JMP]    = Vm.JMP
        Vm.opmap[Op.LE]     = Vm.LE
        Vm.opmap[Op.LIR]    = Vm.LIR
        Vm.opmap[Op.LT]     = Vm.LT
        Vm.opmap[Op.MAX]    = Vm.MAX
        Vm.opmap[Op.MIN]    = Vm.MIN
        Vm.opmap[Op.MRG]    = Vm.MRG
        Vm.opmap[Op.MUL]    = Vm.MUL
        Vm.opmap[Op.NE]     = Vm.NE
        Vm.opmap[Op.NEG]    = Vm.NEG
        Vm.opmap[Op.NF]     = Vm.NF
        Vm.opmap[Op.NFN]    = Vm.NFN
        Vm.opmap[Op.NFS]    = Vm.NFS
        Vm.opmap[Op.NFSS]   = Vm.NFSS
        Vm.opmap[Op.NFSSN]  = Vm.NFSSN
        Vm.opmap[Op.NOP]    = Vm.NOP
        Vm.opmap[Op.NOT]    = Vm.NOT
        Vm.opmap[Op.NTH]    = Vm.NTH
        Vm.opmap[Op.NXT]    = Vm.NXT
        Vm.opmap[Op.OR]     = Vm.OR
        Vm.opmap[Op.POW]    = Vm.POW
        Vm.opmap[Op.PUSH]   = Vm.PUSH
        Vm.opmap[Op.RDN]    = Vm.RDN
        Vm.opmap[Op.RDS]    = Vm.RDS
        Vm.opmap[Op.RET]    = Vm.RET
        Vm.opmap[Op.RST]    = Vm.RST
        Vm.opmap[Op.SAN]    = Vm.SAN
        Vm.opmap[Op.SAS]    = Vm.SAS
        Vm.opmap[Op.SC]     = Vm.SC
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
        Vm.opmap[Op.SS]     = Vm.SS
        Vm.opmap[Op.SSN]    = Vm.SSN
        Vm.opmap[Op.SSS]    = Vm.SSS
        Vm.opmap[Op.STOP]   = Vm.STOP
        Vm.opmap[Op.SUB]    = Vm.SUB
        Vm.opmap[Op.SVN]    = Vm.SVN
        Vm.opmap[Op.SVS]    = Vm.SVS
        Vm.opmap[Op.TTB]    = Vm.TTB
        Vm.opmap[Op.TTC]    = Vm.TTC
        Vm.opmap[Op.TTE]    = Vm.TTE
        Vm.opmap[Op.TTF]    = Vm.TTF
        Vm.opmap[Op.TTL]    = Vm.TTL
        Vm.opmap[Op.TTN]    = Vm.TTN
        Vm.opmap[Op.TTS]    = Vm.TTS
        Vm.opmap[Op.TTT]    = Vm.TTT
        Vm.opmap[Op.UFE]    = Vm.UFE
        Vm.opmap[Op.UNC]    = Vm.UNC
        Vm.opmap[Op.UNS]    = Vm.UNS
        Vm.opmap[Op.USC]    = Vm.USC
        Vm.opmap[Op.USS]    = Vm.USS
        Vm.opmap[Op.UV]     = Vm.UV
        Vm.opmap[Op.VN]     = Vm.VN
        Vm.opmap[Op.VS]     = Vm.VS
    }

    protected bug(reason: string) {
        wto("vm detected bug: " + reason)
        this.dump()
        Utility.bugcheck(reason)
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }

    protected operand(value: Code) : string {
        // This is an operand to the last operation
        if (typeof(value) == "string") {
            return "\"" + value + "\" "
        }
        else if (typeof(value) == "number") {
            return value.toString() + " "
        }
        else if (typeof(value) == "function") {
            return value.name
        }
        else if (value instanceof NScalarRef) {
            return value.source() + " "
        }

        return value.toString() + " [" + typeof(value) + "] "
    }

    public dump() {
        wto("== Object Code ==================")
        let args = 0
        let line = ""
        this.code.forEach((value: Code, index) => {
            if (args == 0) {
                if (typeof(value) == "number") {
                    // Back at the start of an operation. Display the last line
                    wto(line)
                    line = ""
                    args = value >> 8
                    const text = typeof(value) == "number" ? Op[value] : "value"
                    line = Utility.padInteger(index, 5, "0") + ": " + text + " "
                }
                else {
                    wto(line)
                    wto("expected operation at pc=" + index + " but " + value + " found")
                    return
                }
            }
            else {
                line += this.operand(value)
                args--
            }
        })

        // Display the zones we have detected
        wto("== Zones ========================")
        this.zone.forEach((value, index) => wto("zone " + index + ".." + value))

        // Display the final operaton
        wto(line)
        wto("PC=" + this.pc)
        wto("== Value Stack ==================")
        this.valueStack.forEach(value => {
            wto(typeof(value) + ": " + value)
        })
        wto("=================================")
    }

    public trace() : void {
        let stack = ""
        const depth = this.valueStack.length > 3 ? 3 : this.valueStack.length
        for (let i = this.valueStack.length-1;  i >= this.valueStack.length-depth; --i) {
            stack += '<' + this.valueStack[i] + '> '
        }
        const opcode = this.code[this.pc]
        let operation = Op[opcode]
        if (opcode >> 8) {
            operation += " " + this.operand(this.code[this.pc+1])
        }

        let line = Utility.padInteger(this.pc, 4, '0') + ': ' + operation + " | " + stack
        wto(line)
    }

    public clear() : void {
        this.code = []
        this.zone = []
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

    public trim(past: number) {
        this.code.splice(past)
    }

    public goto(pc: number) {
        this.pc = pc
    }

    protected legal(from: number, to: number) : boolean {
        // They must belong to the same zone
        let fromZone: number = null
        let toZone: number = null
        this.zone.forEach((fnend, def) => {
            if (def <= from && from <= fnend) fromZone = from
            if (def <= to   && to   <= fnend) toZone = to
        })
        return fromZone === toZone
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
        const pc = context.root().program.pcForLine(line)
        if (pc == null) throw new Utility.RunTimeError(ErrorCode.CalledLineNot)
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

    protected static AS(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const row = vm.popNumber()
        const col = vm.popNumber()
        vm.push(SArrayRef.AS(context, id, col, row))

    }

    protected static CALL(vm: Vm, context: Context) : void {
        const line = vm.popNumber()
        if (line != -1) {
            // Stack a subroutine call, recording the return address
            context.pushGosubReturn(vm.pc)
            vm.pc = vm.pcForLine(context, line)
        }
    }

    protected static CHN(vm: Vm, context: Context) : void {
        const line = vm.popNumber()
        const name = vm.popString()

        const root = context.root()
        const program = root.program

        // We need to replace the current program with the one held in memory
        const loader = new FileLoader(program.session, name)

        const contents = loader.getRecords()
        if (typeof(contents) == "string") {
            throw new Utility.RunTimeError(contents)
        }
        else if (contents.type == 'B') {

            // Clear the existing program
            program.delete(1, Scanner.MAX_LINE)

            // Load the current program
            loader.loadBasic(contents.contents)
            program.name = name
            program.isData = false

            // Clear the existing contexts
            context.clear()

            // If we have a line number, set that as the next one else
            // atart from the beginning
            program.run(line, context, false)
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.FileWrongType)
        }


    }

    protected static CSV(vm: Vm, context: Context) : void {
        const value = vm.popString()
        const nid = vm.argS()

        // Set the length into element 0
        context.state().setVector(nid, 0.0, value.length)

        // Now set each character into the subsequent elements
        for (let i = 0; i < value.length; ++i) {
            const code = Scanner.characterSet.indexOf(value[i])
            context.state().setVector(nid, i+1, code)
        }
    }

    protected static CVS(vm: Vm, context: Context) : void {

        const nid = vm.argS()
        let result : string = ""

        // The zeroth array element holds the number of characters it holds
        const length = Utility.round(context.state().getVector(nid, 0.0))
        for (let i = 1; i <= length; ++i){

            // Get the next character code - it's an ICL code so 0..63
            const element = Utility.round(context.state().getVector(nid, i))
            if (element < 0 || 63 < element) throw new Utility.RunTimeError(ErrorCode.InvArg)

            // Convert it into the corresponding character and add it to
            // the string result
            const ch = Scanner.characterSet[element]
            result += ch;
        }

        vm.push(result)
    }

    protected static DEF(vm: Vm, context: Context) : void {
        // prepare should have patched this to a jump
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
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

    protected static ERR(vm: Vm, context: Context) : void {
        const error = vm.argS()
        throw new Utility.RunTimeError(error)
    }

    /**
     * Start a new FOR loop
     *
     * The top of the stack contains the from, to and step values. We need
     * to retrieve them and use them to construct a new FOR record which
     * we push onto the control stack ready for the matching NEXT statement.
     *
     * This operation should be followed by a JMP to the matching NEXT so
     * that if the loop is already complete, we don't execute it.
     *
     * @param vm
     * @param context
     */
    protected static FOR(vm: Vm, context: Context) : void {

        // The limits are on the stack
        const step = vm.popNumber()
        const limit = vm.popNumber()
        const from = vm.popNumber()

        // Get the control variable from the instruction stream and step
        // over it
        const index = vm.code[vm.pc++]
        if (index instanceof NScalarRef) {

            // Set up the control data so that it needs to be stepped to
            // be ready for the first iteration
            index.set(context, from - step)

            // Record the active loop on the control stack ready for the
            // NXT operator we're about to branch to. The PC is currently
            // positioned at the JMP so the start of the loop proper is
            // at PC+2. Record this as the NXT operation will need it.
            context.pushForNext(index, limit, step, vm.pc+2)
        }
        else {
            // The parser should not have permitted this
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    protected static GE(vm: Vm, context: Context) : void {
        vm.logicalOp((lhs, rhs) => lhs >= rhs)
    }

    protected static GO(vm: Vm, context: Context) : void {
        const line = vm.popNumber()
        if (line != -1) {
            const pc = vm.pcForLine(context, line)
            // Make sure we aren't branching out of a user-defined function
            if (!vm.legal(vm.pc, pc)) {
                throw new Utility.RunTimeError(ErrorCode.InvExit)
            }
            vm.goto(pc)
        }
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

    protected static EIS(vm: Vm, context: Context) : void {
        // Unwind the control stack to discard partially completed loops
        // and calls
        const [start, pc, state] = context.popImmediate()
        context.root().program.endImmediateStatement(start, pc, state)

        // Force a return to the session
        vm.count = 0
        throw new Utility.RunTimeError("EIS")

    }

    protected static END(vm: Vm, context: Context) : void {
        throw new Utility.RunTimeError("DONE")
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
            context.root().program.needInput()
        }
        else {
            vm.push(value)
        }
    }

    protected static INS(vm: Vm, context: Context) : void {
        const value = vm.inputBuffer.readString(context)
        if (value == null) {
            // We need to interact with the user and try this operation
            // again.
            vm.count = 0
            vm.pc--
            context.root().program.needInput()
        }
        else {
            vm.push(value)
        }
    }

    protected static INE(vm: Vm, context: Context) : void {
        if (vm.inputBuffer.flush()) {
            context.root().session.println("EXTRA INPUT - WARNING ONLY")
        }
    }

    protected static INR(vm: Vm, context: Context) : void {
        vm.inputBuffer.reset(true)
    }

    protected static JMP(vm: Vm, context: Context) : void {
        vm.pc = vm.argN()
    }

    protected static LIR(vm: Vm, context: Context) : void {
        vm.inputBuffer.reset(false)
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

    protected static MRG(vm: Vm, context: Context) : void {
        const margin = Utility.round(vm.popNumber())
        const channel = Utility.round(vm.popNumber())
        const tty = context.root().channels.get(channel)

        if (!tty) {
            throw new Utility.RunTimeError(ErrorCode.FileNotOpen)
        }
        else if (tty instanceof TerminalChannel) {
            if (margin <= 0 || Channel.MAX_MARGIN < margin) throw new Utility.RunTimeError(ErrorCode.InvArg);
            tty.margin(margin)
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.FileWrongType)
        }
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

    protected static NTH(vm: Vm, context: Context) : void {

        // Get the selector
        const k = Utility.round(vm.popNumber())

        // Get the number of lines stacked
        const n = vm.argN()

        // Remove n items from the top of the stack and return them
        const lines = vm.valueStack.splice(-n)

        // If the selector is in range, push that line onto the stack else
        // push -1 (telling GO/CALL not to take any action)
        vm.push (1 <= k && k <= n ? lines[k-1] : -1)
    }

    /**
     * Perform NEXT
     *
     * Unwind the control stack, discarding FOR frames that don't match
     * not GOSUB or UDFs - we insist a loop be matched with a subroutine
     * but we allow jumping out of a nested loop to the outer one to end
     * the inner one early.
     *
     * When we have the matching frame, update the index and decide if we
     * need to branch back to the top to do it again. The PC for the first
     * statement in the FOR loop is in the frame.
     *
     * @param vm
     * @param context
     */
    protected static NXT(vm: Vm, context: Context) : void {

        // The control variable
        const index = vm.code[vm.pc++]
        if (index instanceof NScalarRef) {
            const pc = context.popForNext(index)
            if (pc) {
                // Continue the loop by branching to the first instruction
                vm.pc = pc
            }
        }
        else {
            // Parser won't allow this
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }
    }

    protected static POW(vm: Vm, context: Context) : void {
        vm.binaryOpNN(Math.pow)
    }

    protected static RDN(vm: Vm, context: Context) : void {
        vm.push(context.root().data.readNumber())
    }

    protected static RDS(vm: Vm, context: Context) : void {
        vm.push(context.root().data.readString())
    }

    protected static RET(vm: Vm, context: Context) : void {
        vm.pc = context.popGosubReturn()
    }

    protected static RST(vm: Vm, context: Context) : void {
        context.root().data.restore(vm.argN())
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

    protected static SC(vm: Vm, context: Context) : void {
        const rhs = vm.popString()
        const lhs = vm.popString()
        vm.push(lhs+rhs)
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

    protected static SS(vm: Vm, context: Context) : void {
        vm.push(SScalarRef.SS(context, vm.argS()))
    }

    protected static SSN(vm: Vm, context: Context) : void {
        NScalarRef.SSN(context, vm.argS(), vm.peekNumber())
    }

    protected static SSS(vm: Vm, context: Context) : void {
        SScalarRef.SSS(context, vm.argS(), vm.peekString())
    }

    protected static STOP(vm: Vm, context: Context) : void {
        throw new Utility.RunTimeError("STOP");
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

    protected static UNC(vm: Vm, context: Context) : void {
        const name = vm.argS()
        vm.callUserFunction(name, context)
    }

    protected static UNS(vm: Vm, context: Context) : void {
        // The top of the stack should contain the result of the
        // expression. Check types and store the result in the context
        const name = vm.argS()
        const current = context.state()
        if (current instanceof UDFContext && current.name == name) {
            current.setScalar(name, vm.popNumber())
        }
        else {
            // Can't assign the result of a UDF outside of its definition
            throw new Utility.RunTimeError(ErrorCode.DefInDef)
        }
    }

    protected static USC(vm: Vm, context: Context) : void {
        const name = vm.argS()
        vm.callUserFunction(name, context)
    }

    protected static UFE(vm: Vm, context: Context) : void {
        // The top of the stack should contain the result of the
        // function call. Leave it there and pop the UDF context.
        vm.goto(context.popUDF())
    }

    protected static USS(vm: Vm, context: Context) : void {
        // The top of the stack should contain the result of the
        // expression. Check types and store the result in the context
        const name = vm.argS()
        const current = context.state()
        if (current instanceof UDFContext && current.name == name) {
            current.set$(name, vm.popString())
        }
        else {
            // Can't assign the result of a UDF outside of its definition
            throw new Utility.RunTimeError(ErrorCode.DefInDef)
        }
    }

    protected static UV(vm: Vm, context: Context) : void {
        // We should be in a UDF. Get the current value of it and push
        // it onto the stack
        const ctx = context.state()
        if (ctx instanceof UDFContext) {
            if (ctx.name.endsWith("$")) {
                vm.push(ctx.getString(ctx.name))
            }
            else {
                vm.push(ctx.getNumber(ctx.name))
            }
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.FnendNotinUdf)
        }
    }

    protected static VN(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const col = vm.popNumber()
        vm.push(NVectorRef.VN(context, id, col))
    }

    protected static VS(vm: Vm, context: Context) : void {
        const id = vm.argS()
        const col = vm.popNumber()
        vm.push(SVectorRef.VS(context, id, col))
    }

    public step(count: number, context: Context) {
        this.count = count

        while (this.count-- > 0) {
            //this.dump()
            //this.trace()
            const op = this.code[this.pc++]
            if (typeof(op) == "number" && Vm.opmap[op]) {
                Vm.opmap[op](this, context)
            }
            else {
                this.bug("undefined operation " + op + " at pc " + (this.pc-1))
            }
        }
    }

    protected prepareFOR(forPc: number, program: Program) : number {
        const index = this.code[forPc+1]
        const jmpPc = forPc + 2
        if (index instanceof NScalarRef) {
            for(let nxtPc = jmpPc+2; nxtPc < this.code.length-1; ++nxtPc) {
                if (this.code[nxtPc] == Op.NXT) {
                    const nxtIndex = this.code[nxtPc+1]
                    if (nxtIndex instanceof NScalarRef && nxtIndex.same(index)) {
                        // This is the matching NXT
                        this.patch(jmpPc, [Op.JMP, nxtPc])
                        return nxtPc
                    }
                }
            }
        }

        // We didn't find a match
        const line = program.lineForPc(forPc)
        throw new Utility.RunTimeError(ErrorCode.ForUnmatched, line)
    }

    protected prepareDEF() : void {

        // We have two tasks here - for each DEF we must replace it with
        // a jump around the code and we must also build up a map of the
        // main program and function blocks so we can control legal GOTOs.
        this.zone = []

        let defPc : number = null
        for (let pc = 0; pc < this.code.length; ++pc) {
            const op = this.code[pc]
            if (op == Op.DEF) {
                wto("DEF pc=" + pc + " pc was " + defPc)
                // We should not be in a DEF when we encounter this
                if (defPc !== null) {
                    throw new Utility.RunTimeError(ErrorCode.DefInDef)
                }
                // Note the location for later patching
                defPc = pc
            }
            else if (defPc === null && (op == Op.USS || op == Op.UNS || op == Op.UV || op == Op.UFE)) {
                // Use of UDF name outside of definition
                wto("found op " + Op[op] + " at pc=" + pc + " not in DEF")
                throw new Utility.RunTimeError(ErrorCode.NoUDF)
            }
            else if (defPc !== null && op == Op.END) {
                wto("found op " + Op[op] + " at pc=" + pc + " not in DEF")
                throw new Utility.RunTimeError(ErrorCode.DefInDef)
            }
            else if (op == Op.UFE) {
                wto("UFE at pc=" + pc + " for DEF at " + defPc)
                // This is the end of the current DEF block.
                // Transform
                //
                // DEF xx ...... UFE past:
                //
                // into
                //
                // JMP past BND past-1
                //
                this.code[defPc] = Op.NOP
                this.patch(defPc, [Op.JMP, pc+1])

                // That ends this DEF. Update our map and then drop it
                this.zone[defPc] = pc
                defPc = null
            }

            // Step over any operands
            pc += op >> 8
        }

        // Should not reach the end of the program in a def
        if (defPc !== null) {
            wto("defPc=" + defPc + " at end")
            throw new Utility.RunTimeError(ErrorCode.DefNoFnend)
        }
    }

    public prepare(program: Program) {
        this.dump()
        // We'll keep track of all the NEXT statements that we manage to
        // match up with a for
        let matchedNXT : number[] = []

        for (let pc = 0; pc < this.code.length; ++pc) {
            if (this.code[pc] == Op.FOR) {
                matchedNXT[this.prepareFOR(pc, program)] = 1

                // Skip the nref, JMP and address
                pc += 3
            }
            else {
                // Step over any operands
                pc += this.code[pc] >> 8
            }
        }

        // Make sure every NXT was matched
        this.code.forEach((op, pc) =>{
            if (op == Op.NXT && !(pc in matchedNXT)) {
                const line = program.lineForPc(pc)
                throw new Utility.RunTimeError(ErrorCode.NoFor, line)
            }
            // Step over any operands
            pc += this.code[pc] >> 8
        })

        // Now check the DEF functions
        this.prepareDEF()

    }

    public callUserFunction(name: string, context: Context) {

        // At this point, the stack contains the number of arguments and
        // the arguments themselves. Build a context that binds the stacked
        // arguments to the parameter names. Record the pc to which we
        // return

        context.pushUDF(name, this.pc)

        // Retrieve the arguments into an array
        const argCount = this.popNumber()
        let args : (number|string)[] = []
        for (let i = argCount-1; i >= 0; --i) {
            let arg = this.pop()
            if (typeof(arg) == "number" || typeof(arg) == "string") {
                args[i] = arg
            }
            else {
                throw new Utility.RunTimeError(ErrorCode.BugCheck)
            }
        }

        // Work out the call signature
        const signature = args.map(value => typeof(value) == "number" ? "N" : "S").join()

        // Retrieve the definition of the function and check the signature
        const udf = context.root().program.getUdf(name)
        if (udf.definition.signature() != signature) {
            throw new Utility.RunTimeError(ErrorCode.InvArg)
        }

        // Bind the arguments to the parameter names now we know everything
        // matches
        const parameterNames = udf.definition.bind(args, context.state())

        // Transfer control to the function, remembering to skip past the
        // JMP at the start of the definition
        this.goto(context.root().program.pcForLine(udf.line)+2)
    }
}