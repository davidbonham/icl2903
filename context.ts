/// <reference path="controlstack.ts" />

class Context {

    // The array index of the next line (not the statement number, which
    // is stmtIndex / 100)
    public stmtIndex: number

    // The array index of the next statement to execute
    public nextStmtIndex: number

    // The data defined by the program for READ
    public data: Data;

    protected nscalar : { [name: string] : number}
    protected nvector : { [name: string] : NVector}
    protected narray  : { [name: string] : NArray}

    protected sscalar : { [name: string] : string}
    protected svector : { [name: string] : SVector}
    protected sarray  : { [name: string] : SArray}

    // The stack used to manage subroutines, for-loops and UDFs
    public controlstack: ControlStack

    public constructor(protected _parent: Context, protected _owner: Program) {
        this.controlstack = new ControlStack(this)
        this.data = new Data
        this.clear()
    }

    public get owner() : Program { return this._owner; }

    public terminate() : void {
        this.owner.terminate()
    }

    public clear() : void {

        this.nscalar = {}
        this.sscalar = {}
        this.nvector = {}
        this.svector = {}
        this.narray  = {}
        this.sarray  = {}

        this.controlstack.clear();
        this.data.clear();
    }

    // ---------------------------------------------------------------------
    // Scalar Management
    // ---------------------------------------------------------------------

    protected ownerOfNScalar(name: string) : Context {

        if (name in this.nscalar) {
            return this
        }
        else if (this._parent != null) {
            return this._parent.ownerOfNScalar(name)
        }
        else {
            // This is the top level. New variables will be created here.
            return this
        }
    }

    public setScalar(name: string, value: number) {
        this.nscalar[name] = value

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

    protected ownerOfSScalar(name: string) : Context {

        if (name in this.sscalar) {
            return this;
        }
        else if (this._parent != null) {
            return this._parent.ownerOfSScalar(name)
        }
        else {
            // This is the top level. New variables will be created here.
            return this;
        }
    }

    public set$(name: string, value: string) : void {
        this.sscalar[name] = value
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

    public nextDatum() : Datum {
        if (!this.more()) {
            throw new Utility.RunTimeError(ErrorCode.BugCheck)
        }

        const result = this.data[this.next]
        this.next += 1
        return result
    }
}
