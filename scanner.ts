/// <reference path="utility.ts" />
/// <reference path="errorcode.ts" />

enum TokenType {
    KEY, NUM, STR, REM, NID, SID, UFN, UFS, BAD, CMD, FIL,
    LT, LE, EQ, NE, GE, GT, POW1, MUL, SEP, POW2, CAT, BRA, KET, SUB,
    ADD, COLON, SEMI, HASH, COMMA, QUES, DIV, PAR, REN, UNQ,
    EOL, BIFN, BIFS, UDFN, UDFS
}

class Token
{
    public constructor(private type_: TokenType, private text_: string){}

    public get type() { return this.type_ }
    public get text() { return this.text_ }
}

class Scanner
{
    public static characterSet = "0123456789:;<=>? !\"#£%&'()*+,-./@ABCDEFGHIJKLMNOPQRSTUVWXYZ[$]^\n";

    private static COMMANDS : string[] = [
        // Commands
        "ACC",       "ACCOUNT",   "APP",       "APPEND",    "BYE",
        "CAT",       "CATALOGUE", "CON",       "CONTINUE",  "CSA",
        "CSAVE",     "DAT",       "DATE",      "DEL",       "DELETE",
        "DIS",       "DISC",      "EXT",       "EXTEND",    "GET",
        "HEL",       "HELP",      "KEY",       "LEN",       "LENGTH",
        "LIB",       "LIBRARY",   "LIS",       "LIST",      "MES",
        "MESSAGE",   "NAM",       "NAME",      "NEW",       "OLD",
        "OPE",       "OPEN",      "PUN",       "PUNCH",     "REN",
        "RENUMBER",  "RES",       "RESEQUENCE", "RUN",      "SAV",
        "SAVE",      "SCR",       "SCRATCH",   "TAPE",      "TAP",
        "TIM",       "TIME",      "UNS",       "UNSAVE",    "XPU",
        "XPUNCH",    "KIL",       "KILL",      "?",
    ]

    private static KEYWORDS : string[] = [
        // Keywords for commands
        "FULL", "USER", "WRITE", "SHARE", "RUN",

        // BASIC statements
        "CHAIN",    "CHANGE",   "DATA",     "DEF",      "DIM",
        "END",      "FILE",     "FNEND",    "FOR",      "GO",
        "GOSUB",    "GOTO",     "IF",       "INPUT",    "LET",
        "LINPUT",   "MARGIN",   "MAT",      "NEXT",     "OF",
        "ON",       "PRINT",    "RANDOMISE","RANDOMIZE","READ",
        "REM",      "RESTORE",  "RESET",    "RETURN",   "SCRATCH",
        "STEP",     "STOP",     "THEN",      "TO",      "USING",
        "WITH",     "WRITE",

        // Operators
        "AND",       "EQV",      "IMP",        "MIN",       "MAX",
        "NOT",       "OR",       "XOR",
    ]

    private static BIF_NUMERIC : string[] = [
        // Function-like - numeric
        "ABS",       "ATN",       "CHR",       "COL",       "COS",
        "CPI",       "DET",       "EPS",       "EXP",       "INF",
        "INT",       "LEN",       "LIN",       "LOC",       "LOF",
        "LOG",       "LOP",       "MORE",      "MRG",       "OCC",
        "POS",       "ROW",       "RND",       "SGN",       "SIN",
        "SQR",       "TAB",       "TAN",       "TYP",       "VAL",
    ]

    private static BIF_STRING : string[] = [
        // Function-line - string
        "CHR$",      "DAT$",      "DEL$",      "GAP$",     "LIN$",
        "MUL$",      "REP$",      "SDL$",      "SEG$",     "SGN$",
        "SRP$",      "STR$",      "SUB$",      "TIM$",
    ]

    public static MAX_LINE : number = 9999;

    // Note: we allow 1, .1, 1.1 but not 1.
    private static NUMBER_RE = new RegExp(/^([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?).*/)
    private static FILENAME_RE = new RegExp(/^([$£]?[A-Z][A-Z0-9#+=>&]*).*/)

    private static isWhiteSpace(character : string) {
        return character === ' ' || character === '\t'
    }

    private static segment(text: string, start: number, past: number) : string {
        // Adjust past if it is negative as -1 means remove the final char
        // &c.
        if (past < 0) past = text.length + past;
        return text.slice(start, past);
    }

    private text:     string;
    private pending:  Token;
    private p:        number;

    public constructor(atext: string) {
        this.text = atext + "}}";
        this.pending = null;
        this.p = 0;
    }

    protected skip() : void {
        while (Scanner.isWhiteSpace(this.text[this.p])) this.p += 1;
    }

    public consumeSymbol(wanted : TokenType) : boolean {
        let kind : TokenType;
        this.skip();
        switch (this.text[this.p])
        {
            case '=':
                kind = TokenType.EQ;
                break;
            case '<':
                kind = this.text[this.p + 1] === '=' ? TokenType.LE : this.text[this.p + 1] === '>' ? TokenType.NE : TokenType.LT;
                break;
            case '>':
                kind = this.text[this.p + 1] === '=' ? TokenType.GE : TokenType.GT;
                break;
            case '*':
                kind = this.text[this.p + 1] === '*' ? TokenType.POW1 : TokenType.MUL;
                break;
            case '!':
                kind = TokenType.SEP;
                break;
            case '^':
                kind = TokenType.POW2;
                break;
            case '&':
                kind = TokenType.CAT;
                break;
            case '(':
                kind = TokenType.PAR;
                break;
            case '[':
                kind = TokenType.BRA;
                break;
            case ')':
                kind = TokenType.REN;
                break;
            case ']':
                kind = TokenType.KET;
                break;
            case ':':
                kind = TokenType.COLON;
                break;
            case ';':
                kind = TokenType.SEMI;
                break;
            case '#':
                kind = TokenType.HASH;
                break;
            case ',':
                kind = TokenType.COMMA;
                break;
            case '?':
                kind = TokenType.QUES;
                break;
            case '/':
                kind = TokenType.DIV;
                break;
            case '-':
                kind = TokenType.SUB;
                break;
            case '+':
                kind = TokenType.ADD;
                break;

            default:
                return false;
        }

        if (kind != wanted) return false;

        let length : number;
        switch (kind as TokenType) {
            case TokenType.BAD:
                length = this.text.length - 2 - this.p;
                break;
            case TokenType.LE:
            case TokenType.NE:
            case TokenType.POW1:
            case TokenType.GE:
                length = 2;
                break;
            default:
                length = 1;
                break;
        }

        this.pending = new Token(kind, this.text.substring(this.p, this.p+length));
        this.p += length;

        return true;
    }

    public current() : Token {
        return this.pending;
    }

    public consumeNumber() : string | undefined {
        this.skip();
        const match = Scanner.NUMBER_RE.exec(this.text.substring(this.p));
        if (match !== null) {
            this.pending = new Token(TokenType.NUM, match[1]);
            this.p += match[1].length;
            return this.pending.text;
        }
        else {
            return undefined;
        }
    }

    public consumeUnquoted() : boolean {

        // When parsing DATA statements, items that are not number or quoted
        // strings end at the next comma or the end of the line (not
        // statement). We do skip leading spaces.
        this.skip();
        let current : string = "";
        let next = this.p;

        while (this.text[next] != "," && this.text[next] != "}") {
            current += this.text[next];
            next += 1;
        }

        if (current.length > 0) {
            this.pending = new Token(TokenType.UNQ, current);
            this.p = next;
            return true;
        }
        return false;
    }

    public consumeBifn(wanted: string) : boolean {

        // Function names of numeric built-in functions are all three
        // letters long  (we don't treat MORE as a BIF)
        this.skip()
        if (this.text.length - this.p > 4)
        {
            const current = this.text.substring(this.p, this.p+3);
            const next = this.p + 3;

            // Make sure this isn't a string function lookalike
            if (this.text[next] == "$") return false

            if (Scanner.BIF_NUMERIC.indexOf(current) !== -1 && current == wanted)
            {
                this.pending = new Token(TokenType.BIFN, current);
                this.p = next;
                return true;
            }
        }
        return false;
    }

    public consumeBifs(wanted: string) : boolean {

        // Function names of string built-in functions are all three
        // letters followed by a $ long.
        this.skip()
        if (this.text.length - this.p > 5)
        {
            const current = this.text.substring(this.p, this.p+4);
            const next = this.p + 4;
            if (Scanner.BIF_STRING.indexOf(current) !== -1 && current == wanted)
            {
                this.pending = new Token(TokenType.BIFS, current);
                this.p = next;
                return true;
            }
        }
        return false;
    }

    public consumeUdfs() : boolean
    {
        // Function names of string user-defined functions are of the form
        // FN[A-Z][0-9]?$ so the length is either 4 or 5.
        this.skip()
        const rest = this.text.substring(this.p)
        if (rest.length > 3 && rest.startsWith("FN") && rest[2] >= 'A' && rest[2] <= 'Z') {

            // We have FN[A-Z]. Try for an immediate $
            if (rest[3] === "$") {

                this.pending = new Token(TokenType.UDFS, rest.substring(0, 4));
                this.p += 4;
                return true;
            }

            // Try for the optional [0-9] then $
            if (rest[3] >= '0' && rest[3] <= '9' && rest[4] == '$')
            {
                this.pending = new Token(TokenType.UDFS, rest.substring(0,5));
                this.p += 5;
                return true;
            }
        }
        return false;
    }

    public consumeUdfn() : boolean {

        // Function names of string user-defined functions are of the form
        // FN[A-Z][0-9]? so the length is either 3 or 4.
        this.skip()
        const rest = this.text.substring(this.p)
        if (rest.length > 2 && rest.startsWith("FN") && rest[2] >= 'A' && rest[2] <= 'Z') {

            // We have FN[A-Z]. If the next character is not a digit, ignore
            // it.
            if (rest[3] >= '0' && rest[3] <= '9') {

                this.pending = new Token(TokenType.UDFN, rest.substring(0, 4));
                this.p += 4;
                return true;
            }

            // Just accept the FN[A-Z]
            this.pending = new Token(TokenType.UDFN, rest.substring(0, 3));
            this.p += 3;
            return true;
        }

        return false;
    }


    public consumeKeyword(wanted: string) : boolean {

        this.skip();

        // We are looking for a keyword. Keep consuming letters and $ until
        // we get a keyword.
        let current = this.text[this.p]
        let next = this.p + 1;

        while (Scanner.KEYWORDS.indexOf(current) === -1 || current != wanted)
        {
            // Run out of letters without finding a keyword?
            if (this.text[next] < "A" || "Z" < this.text[next]) return false;

            current += this.text[next];
            next += 1;
        }

        // Found a keyword that exists and was wanted
        this.pending = new Token(TokenType.KEY, current);
        this.p = next;
        return true;
    }

    public consumeRest() : boolean {

        // Comments consume the rest of the line as the token except
        // for the markers we added
        this.pending = new Token(TokenType.REM, Scanner.segment(this.text, this.p, -2));
        this.p = this.text.length - 2;
        return true;
    }

    public  consumeRemark() : boolean {

        this.skip();
        let token = this.text[this.p]
        let next = this.p + 1;

        while ("A" <= this.text[next] && this.text[next] <= "Z") {
            token += this.text[next];
            next += 1;
        }

        if (token === "REM" || token === "REMARK") {
            // Comments consume the rest of the line as the token except
            // for the markers we added
            this.pending = new Token(TokenType.REM, token + Scanner.segment(this.text, next, -2));
            this.p = this.text.length - 2;
            return true;
        }
        return false;
    }

    public consumeString() : boolean {

        this.skip();

        // On entry, p is the index of the opening quote for the string so
        // start looking for the closing quote after it.
        if (this.text[this.p] != '"') return false;
        const closing = this.text.indexOf('"', this.p + 1);
        if (closing == -1) return false;

        this.pending = new Token(TokenType.STR, Scanner.segment(this.text, this.p, closing + 1));
        this.p = closing + 1;
        return true;
    }

    public  consumeLinenumber() : number | undefined
    {
        let pos = this.p;
        if (this.consumeNumber() != null)
        {
            if (this.pending.text.indexOf('.') == -1
             && this.pending.text.indexOf('E') == -1
             && this.pending.text.indexOf('+') == -1
             && this.pending.text.indexOf('-') == -1) {

                // This is a positive integer. Is it a legal line number?
                const value = +this.pending.text
                if (1 <= value && value <= Scanner.MAX_LINE) {
                    return value
                }
            }
        }

        this.p = pos;
        this.pending = null;
        return undefined;
    }

    protected consumeId() : boolean {

        this.skip();

        // We must have a letter not followed by a letter
        if (!Utility.isLetter(this.text[this.p]) || Utility.isLetter(this.text[this.p+1])) return false;

        let current = this.text[this.p];
        this.p += 1;

        let kind = TokenType.NID;

        if (Utility.isDigit(this.text[this.p])) {
            current += this.text[this.p];
            this.p += 1;
        }
        if (this.text[this.p] == '$') {
            current += this.text[this.p];
            this.p += 1;
            kind = TokenType.SID;
        }

        this.pending = new Token(kind, current);
        return true;
    }

    public consumeNid() : boolean {
        let pos = this.p;
        if (this.consumeId() && this.pending.type == TokenType.NID) return true;
        this.p = pos;
        this.pending = null;
        return false;
    }

    public consumeSid(): boolean {
        let pos = this.p;
        if (this.consumeId() && this.pending.type == TokenType.SID) return true;
        this.p = pos;
        this.pending = null;
        return false;
    }

    public consumeCommand(wanted: string): boolean {

        this.skip();

        // With the exception of ? and HELP, which must be specified exactly
        // all commands can be abbreviated to three characters. Commands
        // may not be terminated by letters so if a command is found,
        // consume all of the remaining letters and ensure that the result
        // is still a command.
        if (this.text[this.p] == '?') {

            this.pending = new Token(TokenType.CMD, this.text[this.p]);
            this.p += 1
            return true;
        }
        else if (this.text.length - this.p > 4) {

            // Make sure the first three letters are a known command
            let token = this.text.substring(this.p, this.p+3);
            if (token != wanted) return false;

            // They are. Collect the remaining letters
            let next : number;
            for (next = this.p + 3; Utility.isLetter(this.text[next]); ++next)
            {
                token += this.text[next];
            }

            // If this is no longer a command, the known command was
            // followed by a letter (eg SAV was SAVX).
            if (Scanner.COMMANDS.indexOf(token) === -1) {

                ErrorCode.set(ErrorCode.LetterCannotDelimitCommand);
                return false;
            }

            // Make sure we have the required command. (The caller should
            // specify HELP rather than HEL to ensure we don't allow HELP
            // as a three-letter abbreviation.)
            if (!token.startsWith(wanted)) return false;
            this.pending = new Token(TokenType.CMD, token);
            this.p = next;
            return true;
        }

        return false;
    }

    public consumeFilename() : boolean {

        this.skip();
        const match = Scanner.FILENAME_RE.exec(this.text.substring(this.p));
        if (match != null) {

            this.pending = new Token(TokenType.FIL, match[1]);
            this.p += match[1].length
            return true;
        }
        else {
            return false;
        }
    }

    public atEol() : boolean {
        this.skip();
        return this.text.substring(this.p) === "}}";
    }

    public atEos() : boolean {
        this.skip();
        return this.text[this.p] === '!' || this.atEol();
    }


    public mark()  : number {
        return this.p;
    }

    public restore(old: number) : void {
        this.p = old;
    }
}

