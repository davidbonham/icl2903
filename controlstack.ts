
abstract class ControlFrame {
}

class ReturnFrame extends ControlFrame {
    public constructor(public readonly pc: number) {
        super()
    }
}

class NextFrame extends ControlFrame {
    public constructor(public readonly control: NScalarRef,
                       public readonly to: number,
                       public readonly step: number,
                       public readonly pc: number) {
        super()
    }
}

class ImmediateFrame extends ControlFrame {
    public constructor(public readonly start: number, public readonly pc: number, public readonly state: ProgramState) {
        super()
    }
}

class EndFrame extends ControlFrame {
}

class UDFFrame extends ControlFrame {

    public constructor(public readonly returnToStmtIndex: number, public readonly args: Expression[]) {
        super()
    }
}

class ControlStack {

    protected stack : ControlFrame[]

    public constructor(protected readonly context: Context)  {
        this.stack = []
    }

    public clear() : void {
        this.stack = []
        this.stack.push(new EndFrame)
    }

    public empty() : boolean {
        return this.stack.length == 0
    }

    public doUDF(lineno: number, args: Expression[]) : void {
        this.stack.push(new UDFFrame(this.context.nextStmtIndex, args))
    }

    public doGosub(pc: number) : void  {
        this.stack.push(new ReturnFrame(pc));
    }

    public doImmediate(start: number, oldpc: number, oldstate: ProgramState) : void  {
        this.stack.push(new ImmediateFrame(start, oldpc, oldstate));
    }

    public doEndImmediate() {
        // We have reached the end of an immediate statement. Unwind any
        // incomplete frames and the immediate frame itself
        let top: ControlFrame = null
        while (this.stack.length > 0) {
            top = this.stack.pop()
            if (top instanceof ImmediateFrame) {
                // Restore the program state from the frame
                return [top.start, top.pc, top.state]
            }
        }

    }

    public doReturn() : number {
        // It isn't clear from the documentation how RETURN interacts with FOR
        // loops. Consider
        //
        // 100 GOSUB 200
        // 110 STOP
        // 200 FOR I=1 TO 10
        // 210 RETURN
        // 220 NEXT I
        //
        // I assume that RETURN pops NEXT elements off the control stack until we
        // find a RETURN element (or run out)
        let pc = 0
        while (pc == 0) {
            const frame = this.stack.pop()
            if (frame instanceof ReturnFrame) {
                pc = frame.pc
            }
            else if (frame instanceof NextFrame) {
                // Drop FOR loops in subroutine
            }
            else if (frame instanceof UDFFrame) {
                throw new Utility.RunTimeError(ErrorCode.InvExit);
            }
            else {
                // Must be the stack end marker so there was no return
                // frame
                throw new Utility.RunTimeError(ErrorCode.NoReturn);
            }
        }

        return pc
    }


    public doFor(index: NScalarRef, to: number, step: number, pc: number) : void {
        this.stack.push(new NextFrame(index, to, step, pc))
    }

    public doNext(index: NScalarRef, context: Context) : number {
        // Here, we'll pop items off the control stack until we find the matching
        // NEXT. If we find a return frame or run out, it means this NEXT had no
        // matching FOR.

        const wantedControl = index;
        let found = false;

        while (!found) {

            // Note: this is a reference to the top stack item
            const top = this.stack[this.stack.length-1]

            if (top instanceof ReturnFrame) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof EndFrame) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof UDFFrame) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof NextFrame) {
                //case NextFrame(c, limit, step, line) => {
                // If this is for a nested loop, ignore it (terminating the loop) else
                // see if we should continue
                const control = top.control
                if (control.same(wantedControl)) {

                    // This is the matching next
                    found = true

                    // Get the next value of the loop control variable
                    const next = index.value(context) + top.step

                    // If it has passed the limit, we end the loop
                    if ((top.step < 0.0 && next < top.to) || (top.step > 0.0 && next > top.to))
                    {
                        this.stack.pop()
                        return null
                    }
                    else
                    {
                        // Update the control variable, branch to the start of the loop
                        // and leave the frame on the stack
                        top.control.set(context, next)
                        return top.pc
                    }
                }
                else {
                    // Not the matching FOR loop so we stop running it
                    // and look for the enclosing one
                    this.stack.pop()
                }
            }
        }
    }
}
