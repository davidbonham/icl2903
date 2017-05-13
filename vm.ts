enum Op {
    ADD,        // N1 N2        => N1+N2        add
    AN,         // C R S        => N,           value of array vector element
    AND,        // L L          => L
    DIV,        // N1 N2        => N1/N2        divide
    DROP,       // V            => ,            drop item on top of stack
    END,        //                              stop execution
    EQ,         // V V          => V == V       test equality
    GE,         // V V          => V >= V       test inequality
    GO,         //              =>              jump to line
    GT,         // V V          => V > V        test inequality
    IMP,        // L L          => L
    JMP,        //                              jump unconditionally
    JF,         // L            =>
    LE,         // V V          => V <= V       test inequality
    LT,         // V V          => V < V        test inequality
    MAX,        // V V          => V            max of two values
    MIN,        // V V          => V            min of two values
    MUL,        // N1 N2        => N1*N2        multiply
    NEG,        // N            => -N ,         Negate
    NE,         // V V          => V != V       test inequality
    NF,         // F            => F(),         apply function to 0 arg
    NFN,        // N F          => F(N),        apply function to 1 arg
    NFS,        // S F          => F(S),        apply function to 1 arg
    NFSS,       // S1 S2 F      => F(S1, S2),   apply function to 2 args
    NFSSN,      // S1 S2 N3 F   => F(S1, S2),   apply function to 3 args
    NOP,
    NOT,        // L            => !L           logical not
    OR,         // L L          => L
    POW,        // N1 N2        => N1^N2        power
    SN,         // S            => N            value of numeric scalar
    SUB,        // N1 N2        => N1-N2        subtract
    PUSH,
    SAN,        // N C R S      => N,           Set Array Numeric
    SOC,        // N            =>              Set Output Channel
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
    VN,         // C S          => N,           value of numeric vector element
    SSS,
    SVS,
    SAS,
}

type Value = number | string | boolean
type Code = Op | Value | Object

class Vm {

    protected pc : number
    protected code: Code[]

    protected valueStack: Value[]

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

    public step(count: number, context: Context) {
        while (count-- > 0) {
            //this.dump()
            const op = this.code[this.pc++]
            switch (op) {
                case Op.ADD:
                    this.binaryOpNN((lhs, rhs) => lhs + rhs)
                    break
                case Op.AND:
                    this.logicalOp((lhs: boolean, rhs: boolean) => lhs && rhs)
                    break
                case Op.DIV:
                    this.binaryOpNN((lhs, rhs) => lhs / rhs)
                    break
                case Op.DROP:
                    this.pop();
                    break
                case Op.EQ:
                    this.logicalOp((lhs, rhs) => lhs == rhs)
                    break
                case Op.GE:
                    this.logicalOp((lhs, rhs) => lhs >= rhs)
                    break
                case Op.GO:
                    this.pc = this.pcForLine(context, this.argN())
                    break
                case Op.GT:
                    this.logicalOp((lhs, rhs) => lhs > rhs)
                    break
                case Op.IMP:
                    this.logicalOp((lhs: boolean, rhs: boolean) => !lhs || rhs)
                    break
                case Op.LE:
                    this.logicalOp((lhs, rhs) => lhs <= rhs)
                    break
                case Op.LT:
                    this.logicalOp((lhs, rhs) => lhs < rhs)
                    break
                case Op.OR:
                    this.logicalOp((lhs: boolean, rhs: boolean) => lhs || rhs)
                    break
                case Op.PUSH:
                    this.push(this.code[this.pc++])
                    break
                case Op.END:
                    EndStmt.exec()
                    break
                case Op.JMP:
                    this.pc = this.argN()
                    break
                case Op.JF: {
                    const destination = this.argN()
                    if (!this.popLogical()) this.pc = destination
                    break
                }
                case Op.MAX:
                    this.binaryOpNN((lhs, rhs) => lhs > rhs ? lhs : rhs)
                    break
                case Op.MIN:
                    this.binaryOpNN((lhs, rhs) => lhs < rhs ? lhs : rhs)
                    break
                case Op.MUL:
                    this.binaryOpNN((lhs, rhs) => lhs * rhs)
                    break
                case Op.NE:
                    this.logicalOp((lhs, rhs) => lhs != rhs)
                    break
                case Op.NEG:
                    this.push(-this.popNumber())
                    break
                case Op.NFN:
                    const fn : (n: number) => number = <(n: number) => number>this.code[this.pc++]
                    const a1 : number = this.popNumber()
                    const result = fn(a1)
                    this.push(result)
                    break
                case Op.NOT:
                    this.push(!this.popLogical())
                    break
                case Op.POW:
                    this.binaryOpNN(Math.pow)
                    break
                case Op.SN:
                    this.push(NScalarRef.SN(context, this.argS()))
                    break
                case Op.SOC:
                    PrintStmt.SOC(context, this.popNumber())
                    break
                case Op.SSN:
                    NScalarRef.SSN(context, this.argS(), this.peekNumber())
                    break
                case Op.SUB:
                    this.binaryOpNN((lhs, rhs) => lhs - rhs)
                    break
                case Op.TTB:
                    PrintStmt.TTB(context)
                    break
                case Op.TTC:
                    PrintStmt.TTC(context)
                    break
                case Op.TTE:
                    PrintStmt.TTE(context)
                    break
                case Op.TTF:
                    PrintStmt.TTF(context, this.popString())
                    break
                case Op.TTL:
                    PrintStmt.TTL(context)
                    break
                case Op.TTN:
                    PrintStmt.TTN(context, this.popNumber())
                    break
                case Op.TTS:
                    PrintStmt.TTS(context, this.popString())
                    break
                case Op.TTT:
                    PrintStmt.TTT(context, this.popNumber())
                    break

                default:
                    this.bug("unknown op pc=" + (this.pc-1) + " op=" + op)
            }
        }
    }
}