
abstract class ControlFrame {
}

class ReturnFrame extends ControlFrame {
    public constructor(public readonly returnToStmtIndex: number) {
        super()
    }
}

class NextFrame extends ControlFrame {
    public constructor(public readonly control: NScalarRef,
                       public readonly to: number,
                       public readonly step: number,
                       public readonly startStmtIndex: number) {
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

    public doUDF(lineno: number, args: Expression[]) : void {
        this.stack.push(new UDFFrame(this.context.nextStmtIndex, args))
    }

    public doGosub() : void  {
        this.stack.push(new ReturnFrame(this.context.nextStmtIndex));
    }

    public doReturn() : void {
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
        this.context.nextStmtIndex = 0;
        while (this.context.nextStmtIndex == 0) {
            const frame = this.stack.pop()
            if (frame instanceof ReturnFrame) {
                this.context.nextStmtIndex = frame.returnToStmtIndex
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
    }


    public doFor(index: NScalarRef, to: number, step: number) : void {
        this.stack.push(new NextFrame(index, to, step, this.context.nextStmtIndex))
    }

    public doNext(index: NScalarRef, context: Context) : void {
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
                    }
                    else
                    {
                        // Update the control variable, branch to the start of the loop
                        // and leave the frame on the stack
                        top.control.set(context, next)
                        context.nextStmtIndex = top.startStmtIndex
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
