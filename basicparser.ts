/// <reference path="ast.ts" />
/// <reference path="scanner.ts" />

class BasicParser
{
    private error: ErrorCode

    constructor() {
        this.error = new ErrorCode
    }
/*
    private static ASTNode syn(string code)
    {
        ErrorCode.set(code);
        return null;
    }
*/
    private  eoc(scanner: Scanner, node: ASTNode) : ASTNode {
        if (node != null) {
            // We parsed the command successfully. If there's nothing left,
            // all is well
            if (scanner.atEol()) return node;

            // Anything left over is an error
            return ErrorCode.CharacterAfterCommand
        }
        else {
            // The parser should have set an error
            if (this.error.get() == ErrorCode.NoError)
            {
                return ErrorCode.BugCheck
            }
            return null;
        }
    }

    private eos(scanner : Scanner, node: ASTNode) : ASTNode {

        if (node != null) {
            if (scanner.atEol()) {
                // We parsed something and there was nothing left over
                return node;
            }
            else {
                // We parsed something but there were more characters
                return ErrorCode.CharacterAfterStatement
            }
        }
        else if (this.error.get() == ErrorCode.NoError){
            // We didn't recognise a statement and
            return ErrorCode.StatementNotRecognised
        }
        else {
            // We recognised the statement but it ddn't parse correctly and
            // we have already set an error
            return this.error.get();
        }
    }

    public parseStatement(scanner: Scanner) : Statement | undefined {
        return undefined
        /*
        return ChangeStmt.parseChange(scanner, out statement)
            || DataStmt.parseData(scanner, out statement)
            || DimStmt.parseDim(scanner, out statement)
            || EndStmt.parseEnd(scanner, out statement)
            || ForStmt.parseFor(scanner, out statement)
            || InputStmt.parseInput(scanner, out statement)
            || LetStmt.parseLet(scanner, out statement)
            || LinputStmt.parseLinput(scanner, out statement)
            || IfStmt.parseIf(scanner, out statement)
            || StopStmt.parseStop(scanner, out statement)
            || GotoStmt.parseGoto(scanner, out statement)
            || GotoOfStmt.parseGotoOf(scanner, out statement)
            || GosubStmt.parseGosub(scanner, out statement)
            || MarginStmt.parse(scanner, out statement)
            || NextStmt.parseNext(scanner, out statement)
            || OnGosubStmt.parseOnGosub(scanner, out statement)
            || OnGotoStmt.parseOnGoto(scanner, out statement)
            || OnThenStmt.parseOnThen(scanner, out statement)
            || PrintStmt.parsePrint(scanner, out statement)
            || NLetStmt.parseNLet(false, scanner, out statement)
            || SLetStmt.parseSLet(false, scanner, out statement)
            || RandomiseStmt.parseRandomise(scanner, out statement)
            || ReadStmt.parseRead(scanner, out statement)
            || RemStmt.parseRem(scanner, out statement)
            || RestoreStmt.parseRestore(scanner, out statement)
            || ReturnStmt.parseReturn(scanner, out statement);
            */
    }
/*
    private static bool parseStatementSequence(Scanner scanner, out SequenceStmt tree)
    {
        // We must have at least one statement next. If we fail, then
        // return its syntax error
        Statement statement;
        if (!parseStatement(scanner, out statement))
        {
            ErrorCode.set(ErrorCode.StatementNotRecognised);
            tree = null;
            return false;
        }

        // Either we have reached the end of the statements or we must have
        // a statement separator before the next one
        if (scanner.at_eol())
        {
            // This is the last element of the sequence
            tree =  new SequenceStmt(statement, null);
            return true;
        }

        if (!scanner.consume_symbol(Scanner.TokenType.SEP))
        {
            // No separator - this text is unexpected
            ErrorCode.set(ErrorCode.CharacterAfterStatement);
            tree = null;
            return false;
        }

        // Got a separator so there must be more statements
        SequenceStmt rest;
        if (!parseStatementSequence(scanner, out rest))
        {
            tree = null;
            return false;
        }
        // Success!
        tree = new SequenceStmt(statement, rest);
        return true;
    }

    private static ASTNode parseEdit(Scanner scanner, int lineNo)
    {
        if (scanner.at_eol())
        {
            // A line number on its own means delete that line if it exists
            return new DeleteCmd(new LineRangeNode(lineNo, lineNo));
        }
        else
        {
            // The text after the line number must be a valid BASIC statement
            // sequence.
            SequenceStmt statementSeq;
            if (parseStatementSequence(scanner, out statementSeq))
            {
                return new LineCmd(lineNo, statementSeq);
            }
            else
            {
                return null;
            }
        }
    }
*/
    public parseCommand(scanner: Scanner) : ASTNode {

        if (scanner.consumeCommand("?")) {
            console.log("got ? eoc=" + scanner.atEol())
            return this.eoc(scanner, new QuestionCmd())
        }
        else if (scanner.consumeCommand("BYE")) {
            return this.eoc(scanner, new ByeCmd)
        }

        return ErrorCode.CommandNotRecognised
    }
        /*
        if (scanner.consume_symbol(Scanner.TokenType.QUES))
        {
            return eoc(scanner, new QuestionCmd());
        }
        else if (scanner.consume_command("BYE"))
        {
            return eoc(scanner, new ByeCmd());
        }
        else if (scanner.consume_command("ACC"))
        {
            return eoc(scanner, new AccountCmd());
        }
        else if (scanner.consume_command("CAT"))
        {
            return eoc(scanner, CatalogueCmd.parse(scanner, false));
        }
        else if (scanner.consume_command("CON"))
        {
            return eoc(scanner, ContinueCmd.parse(scanner));
        }
        else if (scanner.consume_command("DAT"))
        {
            return eoc(scanner, DateCmd.parse(scanner));
        }
        else if (scanner.consume_command("DEL"))
        {
            return eoc(scanner, DeleteCmd.parse(scanner));
        }
        else if (scanner.consume_command("DIS"))
        {
            return eoc(scanner, new DiscCmd());
        }
        else if (scanner.consume_command("GET")
                || scanner.consume_command("OLD"))
        {
            return eoc(scanner, GetCmd.parse(scanner));
        }
        else if (scanner.consume_command("KIL")
                || scanner.consume_command("UNS"))
        {
            return eoc(scanner, KillCmd.parse(scanner));
        }
        else if (scanner.consume_command("LIB"))
        {
            return eoc(scanner, CatalogueCmd.parse(scanner, true));
        }
        else if (scanner.consume_command("LEN"))
        {
            return eoc(scanner, LengthCmd.parse(scanner));
        }
        else if (scanner.consume_command("LIS")
                || scanner.consume_command("PUN")
                || scanner.consume_command("XPU"))
        {
            return eoc(scanner, ListCmd.parse(scanner));
        }
        else if (scanner.consume_command("MES")
                || scanner.consume_command("MESSAGE"))
        {
            return eoc(scanner, MessageCmd.parse(scanner));
        }
        else if (scanner.consume_command("NAM"))
        {
            return eoc(scanner, NameCmd.parse(scanner));
        }
        else if (scanner.consume_command("RES")
                || scanner.consume_command("REN"))
        {
            return eoc(scanner, RenumberCmd.parse(scanner));
        }
        else if (scanner.consume_command("RUN"))
        {
            return eoc(scanner, RunCmd.parse(scanner));
        }
        else if (scanner.consume_command("SAV"))
        {
            return eoc(scanner, SaveCmd.parse(scanner));
        }
        else if (scanner.consume_command("SCR"))
        {
            return eoc(scanner, ScratchCmd.parse(scanner));
        }
        else if (scanner.consume_command("TIM"))
        {
            return eoc(scanner, TimeCmd.parse(scanner));
        }
        else if (scanner.consume_command("KEY")
                || scanner.consume_command("TAP"))
        {
            return eoc(scanner, new NopCmd());
        }

        return null;
    }

*/
    public parse(line : string) : ASTNode | string | undefined {

        let scanner = new Scanner(line, this.error);

        //int lineNo;

        // Assume all will go well. Preserve any current error for the ?
        // command
        //ErrorCode.lastError = ErrorCode.get();
        //ErrorCode.set(ErrorCode.NoError);

        const lineNo = scanner.consumeLinenumber()
        if (lineNo != undefined) {
            // Lines starting with a line number are edits to the program
            //return parseEdit(scanner, lineNo);
            return null
        }
        else
        {
            // Not an edit so try for a statement first.
            const stmt = this.parseStatement(scanner)

            if (stmt instanceof (Statement)) {
                /*
                if (stmt.isImmediateStatement()) {

                    // Parsed the statement and it is allowed in immediate
                    // mode so just check there's no remaining text.
                    return eos(scanner, stmt);
                }
                else  {

                    // Parsed the statement but it is not allowed in
                    // immediate mode
                    return ErrorCode.NotImmediate;
                }
                */
            }
            else {
                // We didn't parse a statement. If an error is set, it means
                // we started to parse a statement so it can't be a command
                // otherwise, if no error is set, try a command.
                if (this.error.get() != ErrorCode.NoError) {
                    return this.error.get();
                }
                else {
                    return this.parseCommand(scanner);
                }
            }
        }
    }
}
