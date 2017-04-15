/// <reference path="controlstack.ts" />

class Context {

    // The array index of the next line (not the statement number, which
    // is stmtIndex / 100)
    public stmtIndex: number

    // The array index of the next statement to execute
    public nextStmtIndex: number

    protected _nscalar : { [name: string] : number}
    //protected _nvector : { [name: string] : NVector}
    //protected _narray  : { [name: string] : NArray}

    protected _sscalar : { [name: string] : string}
    //protected _svector : { [name: string] : SVector}
    //protected _sarray  : { [name: string] : SArray}

    // The stack used to manage subroutines, for-loops and UDFs
    public controlstack: ControlStack

    public constructor(protected _parent: Context, protected _owner: Program) {
        this.controlstack = new ControlStack
    }

    public get owner() : Program { return this._owner; }

    public terminate() : void {
        this.owner.terminate()
    }

    public clear() : void {

        this._nscalar = {}
        this._sscalar = {}
        //this._nvector = {}
        //this._svector = {}
        //this._narray  = {}
        //this._sarray  = {}

        this.controlstack.clear();
        //this._data.clear();
    }
}