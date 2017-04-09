class Context {

    public constructor(protected parent: Context, protected program: Program) {
    }

    public terminate() : void {
        this.program.terminate()
    }
}