abstract class ChangeStmt extends Statement {

    public static parse(scanner: Scanner) : ChangeStmt {

        if (!scanner.consumeKeyword("CHANGE")) return null

        const mark = scanner.mark()
        let sexpr: StringExpression

        if (scanner.consumeNid()) {
            // CHANGE N TO S - N must be a vector
            const nid = scanner.current().text
            let sref: SRef
            if (scanner.consumeKeyword("TO") && (sref = SRef.parse(scanner))) {
                return new ChangeNtoS(nid, sref)
            }
        }
        else if ((sexpr = StringExpression.parse(scanner))) {
            // CHANGE S$ TO N - N must be a vector
            if (scanner.consumeKeyword("TO") && scanner.consumeNid()) {
                const nid = scanner.current().text;
                return new ChangeStoN(sexpr, nid)
            }
        }

        return <ChangeStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
    }
}

class ChangeNtoS extends ChangeStmt {

    public constructor(protected readonly nid: string, protected readonly sref: SRef) {
        super()
    }

    public source() : string {
        return "CHANGE " + this.nid + " TO " + this.sref.source()
    }

    public execute(context: Context) : boolean
    {
        let result = "";

        // The zeroth array element holds the number of characters it holds
        const length = Utility.round(context.state().getVector(this.nid, 0.0))
        for (let i = 1; i <= length; ++i){

            // Get the next character code - it's an ICL code so 0..63
            const element = Utility.round(context.state().getVector(this.nid, i))
            if (element < 0 || 63 < element) throw new Utility.RunTimeError(ErrorCode.InvArg)

            // Convert it into the corresponding character and add it to
            // the string result
            const ch = Scanner.characterSet[element]
            result += ch;
        }

        // Store the resuld in the string variable
        //context.state().set$(this.sref, result)

        return true;
    }

    public compile(vm: Vm) {
        // Form the string from N and leave it on the stack
        vm.emit([Op.CVS, this.nid])
        // Assign to the string
        this.sref.compileAssign(vm)
        // Discard the string still on the stack
        vm.emit1(Op.DROP)
    }
}

class ChangeStoN extends ChangeStmt {


    public constructor(protected readonly sexpr: StringExpression, protected readonly nid: string) {
        super()
    }

    public source() : string {
        return "CHANGE " + this.sexpr.source() + " TO " + this.nid
    }

    public execute(context: Context) : boolean {

        // The string to be changed
        const text = this.sexpr.value(context)

        // Set the length into element 0
        context.state().setVector(this.nid, 0.0, text.length)

        // Now set each character into the subsequent elements
        for (let i = 0; i < text.length; ++i) {
            const code = Scanner.characterSet.indexOf(text[i])
            context.state().setVector(this.nid, i+1, code)
        }

        return true;
    }

    public compile(vm: Vm) {
        // Place the string on the stack
        this.sexpr.compile(vm)
        // Place it in the vector
        vm.emit([Op.CSV, this.nid])
    }
}
