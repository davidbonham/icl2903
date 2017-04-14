class Context {

    public constructor(protected _parent: Context, protected _owner: Program) {
    }

    public get owner() : Program { return this._owner; }

    public terminate() : void {
        this.owner.terminate()
    }
}