    class GotoStmt extends Statement {

        private constructor(protected lineNumber: number, protected readonly keyword: string) {
            super()
        }

        // The GOTO statement can be introduced by either of the sequences GOTO
        // or GO TO. The GO keyword is also used to introduce the GO SUB
        // statement.

        public static parse(scanner: Scanner) : GotoStmt {
            const mark = scanner.mark();
            const goto = scanner.consumeKeyword("GOTO")
            const go_to = goto ? false : (scanner.consumeKeyword("GO") && scanner.consumeKeyword("TO"))
            if (goto || go_to) {

                const line = scanner.consumeLinenumber()
                if (line && scanner.atEos()) {
                    return new GotoStmt(line, goto ? "GOTO" : "GO TO");
                }
                else {
                    return <GotoStmt>this.fail(scanner, ErrorCode.StatementNotRecognised, mark)
                }
            }

            // Neither GOTO nor GO TO seen so leave for the next parser
            scanner.restore(mark)
            return null
        }

        public source() : string {
            return this.keyword + ' ' + this.lineNumber
        }

        public execute(context: Context) : boolean {
            context.nextStmtIndex = this.lineNumber*100
            return false;
        }

        public renumber(lineMap : number[]) {
            if (this.lineNumber in lineMap) this.lineNumber = lineMap[this.lineNumber]
        }
    }
