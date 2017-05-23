/// <reference path="controlstack.ts" />

class Context {

    // TODO: Remove this when all of the execute methods no longer need it
    public nextStmtIndex: number

    protected stack: BaseContext[]
    protected current: BaseContext

    public constructor() {
        this.stack = []
        this.current = null
    }

    public clear() {
        wto("context clear")
        // Return to the very top of the context chain
        this.current = this.root()

        // Discard all of the variables and channels
        this.root().clear()

        // Discard all of the other contexts
        this.stack = []
    }

    protected pop()  {
        this.current = this.stack.pop()
        this.dump("after context pop")
    }

    public pushRoot(session: Session.Session, program: Program) {
        this.current = new RootContext(session, program)
        this.dump("after pushRoot")
    }

    public pushGosubReturn(pc: number) {
        this.stack.push(this.current)
        this.current = new GosubReturnContext(this.current, pc)
        this.dump("after pushGosubReturn")
    }

    public pushForNext(index: NScalarRef, limit: number, step: number, top: number) {
        this.stack.push(this.current)
        this.current = new ForNextContext(this.current, index, limit, step, top)
        this.dump("after pushForNext")
    }

    public pushUDF(pc: number) {
        this.stack.push(this.current)
        this.current = new UDFContext(this.current, pc)
    }

    public pushImmediate(start: number, oldpc: number, programstate: ProgramState) {
        this.stack.push(this.current)
        this.current = new ImmediateContext(this.current, start, oldpc, programstate)
    }

    public popForNext(index: NScalarRef) : number {

        // Here, we'll pop items off the control stack until we find the matching
        // NEXT. If we find a return frame or run out, it means this NEXT had no
        // matching FOR.

        const wantedControl = index;
        let found = false;

        while (!found) {

            // Note: this is a reference to the top stack item
            const top = this.current

            if (top instanceof GosubReturnContext) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof EndContext) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof UDFContext) {
                throw new Utility.RunTimeError(ErrorCode.NoFor)
            }
            else if (top instanceof ImmediateContext) {
                // If we're passing through an immediate frame, that's OK
                // it just means the user typed something like GOTO 10 so
                // we carry on to the end of the program and ignore the
                // saved state.
                this.pop()
            }
            else if (top instanceof ForNextContext) {
                //case NextFrame(c, limit, step, line) => {
                // If this is for a nested loop, ignore it (terminating the loop) else
                // see if we should continue
                const control = top.control
                if (control.same(wantedControl)) {

                    // This is the matching next
                    found = true

                    // Get the next value of the loop control variable
                    const next = index.value(this) + top.step

                    // If it has passed the limit, we end the loop
                    if ((top.step < 0.0 && next < top.to) || (top.step > 0.0 && next > top.to)) {
                        this.pop()
                        this.dump("after popForNext matched, end loop")
                        return null
                    }
                    else {
                        // Update the control variable, branch to the start of the loop
                        // and leave the frame on the stack
                        top.control.set(this, next)
                        return top.pc
                    }
                }
                else {
                    // Not the matching FOR loop so we stop running it
                    // and look for the enclosing one
                    this.pop()
                    this.dump("after popForNext unmatched")
                }
            }
        }
    }

    public popGosubReturn() {
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
            this.dump("popGosubReturn in loop")

            let frame = this.current
            if (frame instanceof GosubReturnContext) {
                pc = frame.pc
            }
            else if (frame instanceof ForNextContext) {
                // Drop FOR loops in subroutine
            }
            else if (frame instanceof UDFContext) {
                throw new Utility.RunTimeError(ErrorCode.InvExit);
            }
            else if (top instanceof ImmediateContext) {
                // If we're passing through an immediate frame, that's OK
                // it just means the user typed something like GOTO 10 so
                // we carry on to the end of the program and ignore the
                // saved state.
            }
            else {
                // Must be the stack end marker so there was no return
                // frame
                throw new Utility.RunTimeError(ErrorCode.NoReturn);
            }
            this.pop()
        }
        this.dump("popGosubReturn exit")

        return pc

    }

    public popImmediate() : [number, number, ProgramState] {
        // We have reached the end of an immediate statement. Unwind any
        // incomplete frames and the immediate frame itself
        for(;;) {
            const top = this.current
            if (top instanceof ImmediateContext) {
                // Restore the program state from the frame
                return [top.start, top.oldpc, top.programstate]
            }
            this.pop()
        }
    }

    public root() : RootContext {
        return this.current.root
    }

    public state() : StateContext {
        return this.current.state
    }

    public parent() : BaseContext {
        return this.current.parent
    }

    public dump(title: string) {
        wto("Context Stack: " + title)
        this.stack.forEach(context => context.dump())
        this.current.dump()
    }
}
abstract class BaseContext {

    public root : RootContext
    public state: StateContext
    public parent: BaseContext

    protected link(root: RootContext, state: StateContext, parent: BaseContext) {
        this.root = root
        this.state = state
        this.parent = parent
    }

    public abstract dump() : void

}


class StateContext extends BaseContext {

    protected nscalar : { [name: string] : number}
    protected nvector : { [name: string] : NVector}
    protected narray  : { [name: string] : NArray}

    protected sscalar : { [name: string] : string}
    protected svector : { [name: string] : SVector}
    protected sarray  : { [name: string] : SArray}

    public dump() {
        wto("StateContext")
    }

    public clear() : void {
        this.nscalar = {}
        this.sscalar = {}
        this.nvector = {}
        this.svector = {}
        this.narray  = {}
        this.sarray  = {}
    }

    public constructor(parent: BaseContext) {
        super()
        this.link(parent ? parent.root : null, this, parent)
        this.nscalar = {}
        this.sscalar = {}
        this.nvector = {}
        this.svector = {}
        this.narray  = {}
        this.sarray  = {}
      }

    // ---------------------------------------------------------------------
    // Scalar Management
    // ---------------------------------------------------------------------

    protected ownerOfNScalar(name: string) : StateContext {

        if (name in this.nscalar) {
            // We have the state for this scalar
            return this
        }
        else if (this.parent != null) {
            // We don't have the state for this scalar so advance to the
            // context that manages the parent's state
            return this.parent.state.ownerOfNScalar(name)
        }
        else {
            // This is the top level. New variables will be created here.
            return this
        }
    }

    public setScalar(name: string, value: number) {
        this.nscalar[name] = value
    }

    protected ownerOfSScalar(name: string) : StateContext {

        if (name in this.sscalar) {
            return this;
        }
        else if (this.parent != null) {
            return this.parent.state.ownerOfSScalar(name)
        }
        else {
            // This is the top level. New variables will be created here.
            return this;
        }
    }

    public set$(name: string, value: string) : void {
        this.sscalar[name] = value
    }

    public getNumber(name: string) : number {

        // Search up the stack of contexts looking for the first definition
        // of this name, or, if there is none, the top level context where
        // now variables will be created.
        const owner = this.ownerOfNScalar(name)

        // If this context does not have such a scalar, we have not yet
        // assigned a value to it.
        if (!(name in owner.nscalar)) throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned);
        return owner.nscalar[name]
    }

    public getString(name: string) : string {
        // Search up the stack of contexts looking for the first definition
        // of this name, or, if there is none, the top level context where
        // now variables will be created.
        const owner = this.ownerOfSScalar(name)

        // If this context does not have such a scalar, we have not yet
        // assigned a value to it.
        if (!(name in owner.sscalar)) throw new Utility.RunTimeError(ErrorCode.UnassignedString)
        return owner.sscalar[name]
    }

    // ---------------------------------------------------------------------
    // Vector Management
    // ---------------------------------------------------------------------

    protected dimension(value: number) : number {
        if (value > 0 && value < 9999 && Math.floor(value)== value) {
            return Math.floor(value)
        }
        else {
            throw new Utility.RunTimeError(ErrorCode.DimInvalid)
        }
    }

    public dimVector(name: string, bound: number) : void {
        // We can't dimension a vector if it already exists
        if (name in this.nvector || name in this.narray) throw new Utility.RunTimeError(ErrorCode.ReDim);
        this.nvector[name] = new NVector(this.dimension(bound));
    }

    public setVector(name: string, subscript: number, value: number) : void {
        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.nvector)) this.dimVector(name, 10)

        const vector = this.nvector[name]
        if (vector.bound < subscript || subscript < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Now we know the subscript is legal, we dare convert it to an integer by
        // rounding, as is the BASIC convention
        const index = Math.floor(subscript + 0.5)
        vector.elements[index] = value
    }

    public getVector(name: string, subscript: number) : number {

        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.nvector)) this.dimVector(name, 10)

        const vector = this.nvector[name]
        if (vector.bound < subscript || subscript < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Now we know the subscript is legal, we dare convert it to an integer by
        // rounding, as is the BASIC convention
        const index = Math.floor(subscript + 0.5)

        // This element might not be initialised yet
        if (!(index in vector.elements)) throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)

        // This is the result
        return vector.elements[index]
    }

    public dimVector$(name: string, bound: number) : void {
        // We can't dimension a vector if it already exists
        if (name in this.svector || name in this.sarray) throw new Utility.RunTimeError(ErrorCode.ReDim)
        this.svector[name] = new SVector(this.dimension(bound))
    }

    public setVector$(name: string, subscript: number, value: string) : void {
        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.svector)) this.dimVector$(name, 10);

        const vector = this.svector[name]
        if (vector.bound < subscript || subscript < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Now we know the subscript is legal, we dare convert it to an integer by
        // rounding, as is the BASIC convention
        var index = Math.floor(subscript + 0.5)
        vector.elements[index] = value
    }

    public getVector$(name: string, subscript: number) : string {
        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.svector)) this.dimVector$(name, 10)

        const vector = this.svector[name]
        if (vector.bound < subscript || subscript < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Now we know the subscript is legal, we dare convert it to an integer by
        // rounding, as is the BASIC convention
        const index = Math.floor(subscript + 0.5)

        // This element might not be initialised yet
        if (!(index in vector.elements)) throw new Utility.RunTimeError(ErrorCode.UnassignedString)

        // This is the result
        return vector.elements[index]
    }

    // ---------------------------------------------------------------------
    // Array Management
    // ---------------------------------------------------------------------

    public getArray(name: string,  col: number, row: number) : number {

        // Make sure the array exists, declaring it by default if necessary
        if (!(name in this.narray)) this.dimArray(name, 10, 10)
        const array = this.narray[name]

        // Check the subscripts are in range
        if (array.colBound < col || col < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)
        if (array.rowBound < row || row < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Locate the element
        const index = Math.floor(col + 0.5) * (array.colBound + 1) + Math.floor(row + 0.5)

        // It must exist
        if (!(index in array.elements)) throw new Utility.RunTimeError(ErrorCode.OverflowOrUnassigned)

        return array.elements[index]
    }

    public setArray(name: string, col: number, row: number, value: number) : void {
        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.narray)) this.dimArray(name, 10, 10)
        const array = this.narray[name]

        // Check the subscripts are in range
        if (array.colBound < col || col < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)
        if (array.rowBound < row || row < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Locate the element
        const index = Math.floor(col + 0.5) * (array.colBound + 1) + Math.floor(row)
        array.elements[index] = value
    }

    public dimArray(name: string, colBound: number, rowBound: number) : void {
        if (name in this.nvector || name in this.narray) throw new Utility.RunTimeError(ErrorCode.ReDim)
        this.narray[name] = new NArray(this.dimension(colBound), this.dimension(rowBound))
    }

    public getArray$(name: string, col: number, row: number) : string {
        // Make sure the array exists, declaring it by default if necessary
        if (!(name in this.sarray)) this.dimArray$(name, 10, 10)
        const array = this.sarray[name]

        // Check the subscripts are in range
        if (array.colBound < col || col < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)
        if (array.rowBound < row || row < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Locate the element
        const index = Math.floor(col + 0.5) * (array.colBound + 1) + Math.floor(row + 0.5)

        // It must exist
        if (!(index in array.elements)) throw new Utility.RunTimeError(ErrorCode.UnassignedString)

        return array.elements[index]
    }

    public setArray$(name: string, col: number, row: number, value: string) : void  {
        // Before we can check if the index is in range, we must make sure the
        // vector exists, declaring it with eleven elements 0..10 by default if it
        // has not been dimensioned. (We need to do this because of RUN CLEAR.)
        if (!(name in this.sarray)) this.dimArray$(name, 10, 10)
        const array = this.sarray[name]

        // Check the subscripts are in range
        if (array.colBound < col || col < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)
        if (array.rowBound < row || row < 0.0) throw new Utility.RunTimeError(ErrorCode.Subscript)

        // Locate the element
        const index = Math.floor(col + 0.5) * (array.colBound + 1) + Math.floor(row + 0.5)
        array.elements[index] = value;
    }

    public dimArray$(name: string, colBound: number, rowBound: number) : void {
        if (name in this.svector || name in this.sarray) throw new Utility.RunTimeError(ErrorCode.ReDim);
        this.sarray[name] = new SArray(this.dimension(colBound), this.dimension(rowBound));
    }
}

class EndContext extends Context {
}

class UDFContext extends StateContext {

    public constructor(parent: BaseContext, public readonly pc: number) {
        super(parent)
    }

    public dump() {
        wto("UDFContext pc=" + this.pc)
    }
}


class RootContext extends StateContext {

    // The data defined by the program for READ
    public data: Data;

    // The I/O channels as seen by this program. Channel 0 is the tty
    protected _channels: Channels
    public get channels() { return this._channels; }
    protected currentInput: TerminalChannel
    protected currentOutput: TerminalChannel

    public constructor(public readonly session: Session.Session, public readonly program: Program) {
        super(null)
        this.link(this, this, null)

        this._channels = new Channels
        this._channels.set(0, new TTYChannel(session))
        this.currentInput = <TerminalChannel>this._channels.get(0)
        this.currentOutput = <TerminalChannel>this._channels.get(0)

        this.data = new Data
    }

    public clear() {
        super.clear()
        this.data.clear()
    }

        protected closeChannels() : void {
        // No channel I/O yet
        this.currentInput = <TerminalChannel>this._channels.get(0)
        this.currentOutput = <TerminalChannel>this._channels.get(0)
    }

    public setInputChannel(channel: TerminalChannel) {
        this.currentInput = channel
    }

    public setOutputChannel(channel: TerminalChannel) {
        this.currentOutput = channel
    }

    public getOutputChannel() : TerminalChannel{
        return this.currentOutput
    }

    public getInputChannel() : TerminalChannel{
        return this.currentInput
    }

    public dump() {
        wto("RootContext")
    }
}

class ForNextContext extends BaseContext {

    public constructor(public readonly parent: BaseContext,
                       public readonly control: NScalarRef,
                       public readonly to: number,
                       public readonly step: number,
                       public readonly pc: number) {
        super()
        this.link(parent.root, parent.state, parent)
    }

    public dump() {
        wto("ForNextContext control=" + this.control.source() + " to=" + this.to + " step=" + this.step + " pc=" + this.pc)
    }

}

class GosubReturnContext extends BaseContext {

    public constructor(public readonly parent: BaseContext,
                       public readonly pc: number) {
        super()
        this.link(parent.root, parent.state, parent)
    }

    public dump() {
        wto("GosubReturnContext pc=" + this.pc)
    }

}

class ImmediateContext extends BaseContext {

    public constructor(public readonly parent: BaseContext,
                       public readonly start: number,
                       public readonly oldpc: number,
                       public readonly programstate: ProgramState) {
        super()
        this.link(parent.root, parent.state, parent)
    }

    public dump() {
        wto("ImmediateContext start=" + this.start + " oldpc=" + this.oldpc + " programstate=" + ProgramState[this.programstate])
    }
}

    // The array index of the next line (not the statement number, which
    // is stmtIndex / 100)
    //public stmtIndex: number

    // The array index of the next statement to execute
    //public nextStmtIndex: number



    // The stack used to manage subroutines, for-loops and UDFs
    //public controlstack: ControlStack

    //public constructor(protected _parent: Context, protected _owner: Program) {
    //    this.controlstack = new ControlStack(this)
    //    this.data = new Data
    //    this.clear()
    //}

    //public get owner() : Program { return this._owner; }

    //public terminate() : void {
    //    this.owner.terminate()
    //}
//}


class NVector {

    public elements: number[]

    public constructor(public readonly bound: number) {
        this.elements = []
    }
}

class NArray {
    public elements : number[]

    public constructor(public readonly colBound: number, public readonly rowBound: number) {
        this.elements = []
    }
}

class SVector {
    public elements : string[]
    public constructor(public readonly bound: number) {
        this.elements = []
    }
}

class SArray {
   public elements : string[]

    public constructor(public readonly colBound: number, public readonly rowBound: number) {
        this.elements = []
    }
}

class Data
{
    // DATA statements get preprocessed and their data is held in this list
    public data: Datum[]

    // map[n] is the index in data of the first datum for the DATA
    // statement on line n. For the RESTORE statement.
    public map: number[]

    protected next: number

    public clear() : void {
        this.data = []
        this.map = []
        this.next = 0
    }

    public add(line: number, datum: Datum) : void {

        // If we haven't seen this line before, note the position of
        // its first datum in the list.
        if (!(line in this.map)) {
            this.map[line] = this.data.length;
        }
        this.data.push(datum)
    }

    public constructor() {
        this.clear()
    }

    public restore(line: number) : void {

        // Typically, the line number will be in the map. If it isn't,
        // then find the first entry in the map greater than the line
        // number. If there isn't one, position to the end of the data.
        let position = -1;
        if ((line in this.map)) {
            position = this.map[line]
        }
        else {
            this.map.forEach((pos, lineNumber) => {
                if (position === -1 && lineNumber >= line) {
                    position = pos
                }
            })

            if (position == -1) {
                position = this.data.length
            }
        }
        this.next = position;
    }

    public more() : boolean {
        return this.next < this.data.length
    }

    public readNumber() : number {
        if (!this.more()) {
            throw new Utility.RunTimeError(ErrorCode.ReadBeyond)
        }
        else {
            const datum = this.nextDatum()
            if (!(datum instanceof NDatum)) {
                throw new Utility.RunTimeError(ErrorCode.BadInput)
            }
            else {
                const result = parseFloat(datum.value())
                if (Number.isNaN(result)) {
                    throw new Utility.RunTimeError(ErrorCode.BadInput)
                }
                else {
                    return result
                }

            }
        }
    }
    public readString() : string {
        if (!this.more()) {
            throw new Utility.RunTimeError(ErrorCode.ReadBeyond)
        }
        else {
            const datum = this.nextDatum()
            if (!(datum instanceof SDatum)) {
                throw new Utility.RunTimeError(ErrorCode.BadInput)
            }
            else {
                return datum.value()
            }
        }
    }

    public nextDatum() : Datum {
        if (!this.more()) {
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }

        const result = this.data[this.next]
        this.next += 1
        return result
    }
}
