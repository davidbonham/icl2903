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

    public compile(vm: Vm) {
        // Place the string on the stack
        this.sexpr.compile(vm)
        // Place it in the vector
        vm.emit([Op.CSV, this.nid])
    }
}
