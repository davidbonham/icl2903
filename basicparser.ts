/// <reference path="ast.ts" />
/// <reference path="scanner.ts" />

class BasicParser
{
    private error: ErrorCode

    constructor () {
        ErrorCode.set(ErrorCode.NoError)
    }

    private  eoc(scanner: Scanner, node: ASTNode) : ASTNode {

        if (node instanceof Command) {
            // We parsed the command successfully. If there's nothing left,
            // all is well otherwise there is too much text
            if (scanner.atEol()) return node;

            // Anything left over is an error
            return ErrorCode.CharacterAfterCommand
        }
        else {

            // We failed to parse the arguments for this command. All commands
            // can be determined from the first token on the line so there
            // is no chance another command might parse it.
            return ErrorCode.CommandNotRecognised
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
        else if (ErrorCode.get() == ErrorCode.NoError){
            // We didn't recognise a statement and
            return ErrorCode.StatementNotRecognised
        }
        else {
            // We recognised the statement but it ddn't parse correctly and
            // we have already set an error
            return ErrorCode.get();
        }
    }

    public static parseStatement(scanner: Scanner) : Statement | undefined {
        return DataStmt.parse(scanner)
            || DimStmt.parse(scanner)
            || EndStmt.parse(scanner)
            || ForStmt.parse(scanner)
            || GoBase.parse(scanner)
            || IfStmt.parse(scanner)
            || InputStmt.parse(scanner)
            || LetStmt.parse(scanner)
            || LinputStmt.parse(scanner)
            || NextStmt.parse(scanner)
            || PrintStmt.parse(scanner)
            || ReadStmt.parse(scanner)
            || RandomiseStmt.parse(scanner)
            || RemStmt.parse(scanner)
            || RestoreStmt.parse(scanner)
            || ReturnStmt.parse(scanner)
            || StopStmt.parse(scanner)
            || NLetStmt.parseNLet(false, scanner)
            || SLetStmt.parseSLet(false, scanner)
        /*
        return ChangeStmt.parseChange(scanner, out statement)
            || MarginStmt.parse(scanner, out statement)
            */
    }

    protected parseStatementSequence(scanner: Scanner) : SequenceStmt {

        // We must have at least one statement next. If we fail, then
        // return its syntax error
        const statement = BasicParser.parseStatement(scanner)
        if (statement == undefined) {

            ErrorCode.set(ErrorCode.StatementNotRecognised)
            return null;
        }

        // Either we have reached the end of the statements or we must have
        // a statement separator before the next one
        if (scanner.atEol()) {
            // This is the last element of the sequence
            return  new SequenceStmt(statement, null);
        }

        if (!scanner.consumeSymbol(TokenType.SEP)) {
            // No separator - this text is unexpected
            ErrorCode.set(ErrorCode.CharacterAfterStatement)
            return null;
        }

        // Got a separator so there must be more statements
        const rest = this.parseStatementSequence(scanner)
        if (rest == undefined) {
            return null
        }

        // Success!
        return new SequenceStmt(statement, rest)
    }

    protected parseEdit(scanner: Scanner, lineNo: number) : ASTNode {

        if (scanner.atEol()) {
            // A line number on its own means delete that line if it exists
            return new DeleteCmd(new LineRangeNode(lineNo, lineNo));
        }
        else {
            // The text after the line number must be a valid BASIC statement
            // sequence.
            const statementSeq : SequenceStmt = this.parseStatementSequence(scanner)
            if (statementSeq != undefined) {
                return new LineCmd(lineNo, statementSeq);
            }
            else {
                return ErrorCode.get();
            }
        }
    }

    /**
     * Attempt to parse a command line
     *
     * Positioned at the start of a line of text, attempt to parse a command
     * and if successful, return the resulting object ready for execution.
     * If we fail, return an error indicating the command was not recognised.
     *
     * Because all commands can be identified by the first token on the line,
     * switch on that token to that parser that parses the rest of its command.
     *
     * Once a command parser returns its resulr, we call eoc to ensure there
     * are no tokens following the command. If there are, eoc will return
     * an appropriate error instead of the command object.
     *
     * @param scanner
     */
    public parseCommand(scanner: Scanner) : ASTNode {

        if (scanner.consumeCommand("?")) {
            return this.eoc(scanner, new QuestionCmd())
        }
        else if (scanner.consumeCommand("ACC")) {
            return this.eoc(scanner, new AccountCmd())
        }
        else if (scanner.consumeCommand("BYE")) {
            return this.eoc(scanner, new ByeCmd)
        }
        else if (scanner.consumeCommand("CAT")) {
            return this.eoc(scanner, CatalogueCmd.parse(scanner, false))
        }
        else if (scanner.consumeCommand("CON")) {
            return this.eoc(scanner, ContinueCmd.parse(scanner));
        }
        else if (scanner.consumeCommand("DAT")) {
            return this.eoc(scanner, DateCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("DEL")) {
            return this.eoc(scanner, DeleteCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("DIS")) {
            return this.eoc(scanner, new DiscCmd());
        }
        else if (scanner.consumeCommand("GET")
              || scanner.consumeCommand("OLD")) {
            return this.eoc(scanner, GetCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("KIL")
              || scanner.consumeCommand("UNS"))  {
            return this.eoc(scanner, KillCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("LEN")) {
            return this.eoc(scanner, LengthCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("LIB")) {
            return this.eoc(scanner, CatalogueCmd.parse(scanner, true))
        }
        else if (scanner.consumeCommand("LIS")) {
            return this.eoc(scanner, ListCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("NAM")) {
            return this.eoc(scanner, NameCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("NEW")) {
            return this.eoc(scanner, NewCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("PUN")) {
            return this.eoc(scanner, ListCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("RES")
              || scanner.consumeCommand("REN")) {
            return this.eoc(scanner, RenumberCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("RUN")) {
            return this.eoc(scanner, RunCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("SAV")) {
            return this.eoc(scanner, SaveCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("SCR")) {
            return this.eoc(scanner, ScratchCmd.parse(scanner))
        }

        else if (scanner.consumeCommand("TIM")) {
            return this.eoc(scanner, TimeCmd.parse(scanner))
        }
        else if (scanner.consumeCommand("XPU")) {
            return this.eoc(scanner, ListCmd.parse(scanner))
        }

        return ErrorCode.CommandNotRecognised
    }
        /*
        else if (scanner.consume_command("MES")
                || scanner.consume_command("MESSAGE"))
        {
            return eoc(scanner, MessageCmd.parse(scanner));
        }
        else if (scanner.consume_command("KEY")
                || scanner.consume_command("TAP"))
        {
            return eoc(scanner, new NopCmd());
        }
*/
    public parse(line : string) : ASTNode | string | undefined {

        let scanner = new Scanner(line);

        //int lineNo;

        // Assume all will go well. Preserve any current error for the ?
        // command
        //ErrorCode.lastError = ErrorCode.get();
        //ErrorCode.set(ErrorCode.NoError);

        const lineNo = scanner.consumeLinenumber()
        if (lineNo != undefined) {
            // Lines starting with a line number are edits to the program
            return this.parseEdit(scanner, lineNo);
        }
        else
        {
            // Not an edit so try for a statement first.
            const stmt = BasicParser.parseStatement(scanner)

            if (stmt instanceof (Statement)) {

                if (stmt.isImmediateStatement()) {

                    // Parsed the statement and it is allowed in immediate
                    // mode so just check there's no remaining text.
                    return this.eos(scanner, stmt);
                }
                else  {

                    // Parsed the statement but it is not allowed in
                    // immediate mode
                    return ErrorCode.NotImmediate;
                }
            }
            else {
                // We didn't parse a statement. If an error is set, it means
                // we started to parse a statement so it can't be a command
                // otherwise, if no error is set, try a command.
                if (ErrorCode.get() != ErrorCode.NoError) {
                    return ErrorCode.get();
                }
                else {
                    return this.parseCommand(scanner);
                }
            }
        }
    }
}
