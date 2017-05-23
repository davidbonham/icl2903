
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


class ControlStack {

    protected stack : ControlFrame[]

    public constructor(protected readonly context: Context)  {
        this.stack = []
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
        }

        return pc
    }


    public doFor(index: NScalarRef, to: number, step: number, pc: number) : void {
        this.stack.push(new NextFrame(index, to, step, pc))
    }


}
