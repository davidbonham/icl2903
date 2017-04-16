/// <reference path="../ast.ts" />

abstract class LetStmt extends Statement {

    public static parse(scanner: Scanner) : LetStmt {

        const mark = scanner.mark()
        if (scanner.consumeKeyword("LET")) {
            const stmt = NLetStmt.parseNLet(true, scanner) || SLetStmt.parseSLet(true, scanner)
            return stmt ? stmt : <LetStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }
        else {
            return null
        }
    }
}

class NLetStmt extends LetStmt {


    protected constructor(protected readonly hasLet: boolean,
                          protected readonly lvs: NRef[],
                          protected readonly rhs: NumericExpression) {
        super()
    }

    public static parseNLet(hasLet: boolean, scanner: Scanner) : NLetStmt {

        let lvs : NRef[] = []
        const mark = scanner.mark()

        // We recognise this as an assignment statement once we see the
        // first nref on the line.
        let parsedNref = false

        // Accumulate left hand sides.
        let afterEq = 0
        for (;;)
        {
            // Note our position so that when we reach the end of the lvs,
            // we can position after the final =.
            const nref = NRef.parse(scanner)
            if (nref) {
                // Potentially another N=. Note we have seen an nref but
                // only continue to treat it as an lv if it is followed by =
                parsedNref = true
                if (!scanner.consumeSymbol(TokenType.EQ)) break
            }
            else {
                // Didn't see an nref so it can't be an lv
                break;
            }

            lvs.push(nref)
            afterEq = scanner.mark()
        }

        // If we didn't see an nref, this isn't an NLet so allow the next
        // parser to have a go.
        if (!parsedNref) {
            return null
        }

        // This was an NLet. We must have at least one lv.
        if (lvs.length == 0) {
            return <NLetStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        // Now make sure we're ready to parse the rhs
        scanner.restore(afterEq)

        const rhs = NumericExpression.parse(scanner)
        if (!rhs) {
            return <NLetStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new NLetStmt(hasLet, lvs, rhs)
    }

    public source() : string {
        this.lvs.map((value) => value.source() + "=").join()
        return (this.hasLet ? "LET " : "") + this.lvs.map((value) => value.source() + "=").join() + this.rhs.source()
    }

    public execute(context: Context) : boolean {
        const rhs = this.rhs.value(context)
        for (const nref of this.lvs) {
            nref.set(context, rhs);
        }
        return true;
    }
}


/*
class SLetStmt : LetStmt
{
    bool _let;
    List<SRef> _lvs;
    StringExpression _rhs;

    protected SLetStmt(bool let, List<SRef> lvs, StringExpression rhs)
    {
        _let = let;
        _lvs = lvs;
        _rhs = rhs;
    }

    public static bool parseSLet(bool let, Scanner scanner, out Statement tree)
    {
        StringExpression rhs;
        List<SRef> lvs = new List<SRef>();
        int mark = scanner.mark();
        bool parsed_sref = false;

        // Accumulate left hand sides.
        int after_eq = 0;
        for (;;)
        {
            SRef sref;

            // Note our position so that when we reach the end of the lvs,
            // we can position after the final =.
            if (SRef.parse(scanner, out sref))
            {
                // Potentially another S$=. Note we have seen an sref but
                // only continue to treat it as an lv if it is followed by =
                parsed_sref = true;
                if (!scanner.consume_symbol(Scanner.TokenType.EQ)) break;
            }
            else
            {
                // Didn't see an sref so it can't be an lv
                break;
            }

            lvs.Add(sref);
            after_eq = scanner.mark();
        }

        // If we didn't see an nref, this isn't an NLet so allow the next
        // parser to have a go.
        if (!parsed_sref)
        {
            tree = null;
            return false;
        }

        // We must have at least one lv.
        if (lvs.Count() == 0) return fail(scanner, ErrorCode.StatementNotRecognised, mark, out tree);

        // Now make sure we're ready to parse the rhs
        scanner.restore(after_eq);
        if (!StringExpression.parse(scanner, out rhs)) return fail(scanner, ErrorCode.StatementNotRecognised, mark, out tree);

        tree = new SLetStmt(let, lvs, rhs);
        return true;
    }

    override public string source()
    {
        return (_let ? "LET " : "") + string.Join("=", _lvs.Select(lv => lv.source()).ToArray()) + '=' + _rhs.source();
    }

    public override bool execute(Context context)
    {
        string rhs = _rhs.value(context);
        foreach (SRef sref in _lvs)
        {
            sref.set(context, rhs);
        }
        return true;
    }
}
*/
class SLetStmt extends LetStmt {


    protected constructor(protected readonly hasLet: boolean,
                          protected readonly lvs: SRef[],
                          protected readonly rhs: StringExpression) {
        super()
    }

    public static parseSLet(hasLet: boolean, scanner: Scanner) : SLetStmt {

        let lvs : SRef[] = []
        const mark = scanner.mark()

        // We recognise this as an assignment statement once we see the
        // first nref on the line.
        let parsedSref = false

        // Accumulate left hand sides.
        let afterEq = 0
        for (;;)
        {
            // Note our position so that when we reach the end of the lvs,
            // we can position after the final =.
            const sref = SRef.parse(scanner)
            if (sref) {
                // Potentially another N=. Note we have seen an nref but
                // only continue to treat it as an lv if it is followed by =
                parsedSref = true
                if (!scanner.consumeSymbol(TokenType.EQ)) break
            }
            else {
                // Didn't see an nref so it can't be an lv
                break;
            }

            lvs.push(sref)
            afterEq = scanner.mark()
        }

        // If we didn't see an nref, this isn't an NLet so allow the next
        // parser to have a go.
        if (!parsedSref) {
            return null
        }

        // This was an NLet. We must have at least one lv.
        if (lvs.length == 0) {
            return <SLetStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        // Now make sure we're ready to parse the rhs
        scanner.restore(afterEq)

        const rhs = StringExpression.parse(scanner)
        if (!rhs) {
            return <SLetStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
        }

        return new SLetStmt(hasLet, lvs, rhs)
    }

    public source() : string {
        this.lvs.map((value) => value.source() + "=").join()
        return (this.hasLet ? "LET " : "") + this.lvs.map((value) => value.source() + "=").join() + this.rhs.source()
    }

    public execute(context: Context) : boolean {
        const rhs = this.rhs.value(context)
        for (const sref of this.lvs) {
            sref.set$(context, rhs);
        }
        return true;
    }
}
