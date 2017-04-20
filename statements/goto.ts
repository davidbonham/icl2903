/// <reference path="../ast.ts" />

// We have multiple statements with overlapping syntax:
//
// GO TO  numexp OF line [, line]*
// GOTO   "
// GOSUB  "
// GO SUB "
// ON numexp GOTO line [,line]*
// ON numexp GO TO line [,line]*
// ON numexp GOSUB line [,line]*
// ON numexp GO SUB line [,line]*
// GOTO line
// GO TO line
// GOSUB line
// GO SUB line


abstract class GoBase extends Statement {

    protected static parseGotoGosub(scanner: Scanner) : string {
        if (scanner.consumeKeyword("GOTO")) return "GOTO"
        if (scanner.consumeKeyword("GOSUB")) return "GOSUB"
        if (scanner.consumeKeyword("GO")) {
            if (scanner.consumeKeyword("TO")) return "GO TO"
            if (scanner.consumeKeyword("SUB")) return "GO SUB"
        }

        // This is just a failure to recognise these keywords
        return null
    }

    protected static parseLineList(scanner: Scanner) : number[] {

        let lines: number[] = []

        for (;;) {
            const line = scanner.consumeLinenumber()
            if (!line) break
            lines.push(line)
            if (!scanner.consumeSymbol(TokenType.COMMA)) break;
        }

        return lines.length > 0 ? lines : null
    }


    // The GOTO statement can be introduced by either of the sequences GOTO
    // or GO TO. The GO keyword is also used to introduce the GO SUB
    // statement.
    public static parse(scanner: Scanner) : Statement {

        const mark = scanner.mark()

        // Look for a leading GOTO or GOSUB and note which it was
        let keyword = GoBase.parseGotoGosub(scanner)
        if (keyword) {
            return GoBase.parseGoTail(scanner, mark, keyword)
        }

        // The remaining options are ONs. If we don't have an ON, we
        // didn't match this statement so return null and let another
        // parser try
        if (!scanner.consumeKeyword("ON")) return null

        // Next we have the numeric expression that selects the line
        const numexp = NumericExpression.parse(scanner)
        if (numexp) {
            // Next we have a THEN/GOTO/GOSUB choice.
            const keyword = scanner.consumeKeyword("THEN") ? "THEN" : GoBase.parseGotoGosub(scanner)
            if (keyword) {
                // And finally a sequence of lines
                const lines = this.parseLineList(scanner)
                if (lines) {
                    return keyword == "GO SUB" || keyword == "GOSUB"
                        ? new GosubOfStmt(numexp, lines, "ON", keyword)
                        : new GotoOfStmt(numexp, lines, "ON", keyword)
                }
            }
        }

        // No ON nor GOTO nor GO TO seen so leave for the next parser
        scanner.restore(mark)
        return null
    }

    protected static parseGoTail(scanner: Scanner, oldMark: number, keyword: string) : Statement {

        // Valid productions are:
        // tail :== linenumber EOS
        //      |   numexp OF line [, line]*
        // so try to read a line number first but be prepared to backup if
        // we later discover it should have been a numeric expression
        const mark = scanner.mark()
        const line = scanner.consumeLinenumber()
        if (line && scanner.atEos) {
            if (keyword == "GOTO" || keyword == "GO TO") {
                return new GotoStmt(line, keyword)
            }
            else {
                return new GosubStmt(line, keyword)
            }
        }
        else {
            // We didn't parse the first alternative so prepare to try
            // the other
            scanner.restore(mark)
        }

        // Now we want the second production. We must have an expression
        // followed by an OF and a list of at least one line
        let numexp: NumericExpression
        let lines: number[]
        if ((numexp = NumericExpression.parse(scanner))
        &&  scanner.consumeKeyword("OF")
        &&  (lines = this.parseLineList(scanner))) {
            if (keyword == "GOTO" || keyword == "GO TO") {
                return new GotoOfStmt(numexp, lines, keyword, "OF")
            }
            else {
                return new GosubOfStmt(numexp, lines, keyword, "OF")
            }
        }

        return <Statement>this.fail(scanner, ErrorCode.StatementNotRecognised, oldMark)
    }
}

abstract class GoSimple extends GoBase {

    public constructor(protected lineNumber: number, protected readonly keyword: string) {
        super()
    }

    public source() : string {
        return this.keyword + ' ' + this.lineNumber
    }

    public renumber(lineMap : number[]) {
        if (this.lineNumber in lineMap) this.lineNumber = lineMap[this.lineNumber]
    }
}

class GotoStmt extends GoSimple {
    public execute(context: Context) : boolean {
        context.nextStmtIndex = this.lineNumber*100
        return false;
    }
}

class GosubStmt extends GoSimple {
    public execute(context: Context) : boolean {
        context.controlstack.doGosub();
        context.nextStmtIndex = this.lineNumber*100
        return false;
    }
}

abstract class GoLines extends GoBase {

    public constructor(protected readonly numexp: NumericExpression,
                        protected lines: number[],
                        protected readonly keyword: string,
                        protected readonly keyword2: string) {
        super()
    }

    public source() : string {

        return this.keyword + " " + this.numexp.source() + " " + this.keyword2 + " " + this.lines.join(",")
    }

    public renumber(lineMap : number[]) {
        this.lines = this.lines.map((line) => line in lineMap ? lineMap[line] : line)
    }

    protected destination(context: Context) : number {
        // Before we round off the expression and convert it into an integer, check
        // it's roughly in range to avoid conversion overflow
        var expression = this.numexp.value(context);
        if (0 <= expression && expression <= this.lines.length + 2) {
            var index = Utility.round(expression) - 1
            if (0 <= index && index < this.lines.length) {
                return this.lines[index]
            }
        }
        return -1
    }


}

class GotoOfStmt extends GoLines {

    public execute(context: Context) : boolean {
        const line = this.destination(context);
        if (line < 0) return true;

        context.nextStmtIndex = line * 100
        return false;
    }
}


class GosubOfStmt extends GoLines {

    public execute(context: Context) : boolean {

        const line = this.destination(context)
        if (line < 0) return true

        context.controlstack.doGosub()
        context.nextStmtIndex = line * 100
        return false
    }
}

