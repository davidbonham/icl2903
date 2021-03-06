class ErrorCode
{
    // Error messages that end with an exclamation mark are cases where
    // don't have any example of the real message.

    public static NoError = "0";
    public static StatementNotRecognised = "ERROR  86";
    public static CommandNotRecognised = "ERROR  89";
    public static CharacterAfterCommand = "ERROR  88";
    public static CharacterAfterStatement = "ERROR  78";
    public static LetterCannotDelimitCommand = "ERROR  79";
    public static IllegalProgramName = "ILLEGAL PROGRAM NAME";
    public static OverflowOrUnassigned = "ARITHMETIC OVERFLOW OR UNASSIGNED VARIABLE";
    public static SquareRootNegative = "SQUARE ROOT OF A NEGATIVE NUMBER";
    public static BugCheck = "BUG: INTERNAL ERROR DETECTED";
    public static Subscript = "SUBSCRIPT OUT OF RANGE";
    public static UnassignedString = "UNASSIGNED STRING VARIABLE";
    public static NoReturn = "RETURN WITHOUT MATCHING GOSUB!";
    public static NoFor = "'NEXT' WITHOUT MATCHING 'FOR'";
    public static DimInvalid = "DIMENSION NOT VALID!";
    public static ReDim = "ALREADY DIMENSIONED!";
    public static ForUnmatched = "FOR-LOOP NOT MATCHED AT END OF PROGRAM";
    public static BadChannel = "BAD CHANNEL NUMBER!";
    public static FileNotOpen = "FILE NOT OPEN";
    public static BadInput = "BAD INPUT";
    public static ReadBeyond = "ATTEMPT TO READ BEYOND END OF DATA";
    public static InvString = "INVALID STRING IN 'VAL' CONVERSION";
    public static NoEnd = "LAST STATEMENT NOT 'END'";
    public static NoUDF = "USER-DEFINED FUNCTION DOES NOT EXIST!";
    public static InvExit = "INVALID EXIT FROM USER FUNCTION";
    public static InvArg = "INVALID ARGUMENT!";
    public static WrongNumber = "WRONG NUMBER OF ARGUMENTS TO USER FUNCTION!";
    public static NoDim = "NOT AN ARRAY!";
    public static PrintUsing = "PRINT USING FORMAT ERROR";
    public static FileWrongType = "FILE IS OF WRONG TYPE";
    public static NotImp = "NOT YET IMPLEMENTED";
    public static NotImmediate = "STATEMENT NOT ALLOWED IN IMMEDIATE MODE!";
    public static NotIf = "STATEMENT NOT ALLOWED IN IF!";
    public static DupParam = "PARAMETER/LOCAL OCCURS MULTIPLE TIMES IN USER DEFINED FUNCTION!"
    public static FnendNotinUdf = "FNEND STATEMENT NOT IN USER DEFINED FUNCTION!"
    public static DefNoFnend = "USER DEFINED FUNCTION HAS NO FNEND!"
    public static DefInDef = "STATEMENT NOT ALLOWED IN USER DEFINED FUNCTION!"
    public static CalledLineNot = "CALLED LINE NUMBER DOES NOT EXIST"


    public static lastError = ErrorCode.NoError;

    public static textOf(code : string)
    {
        if (code === ErrorCode.NoError) return "NO ERROR";
        if (code === ErrorCode.StatementNotRecognised) return "STATEMENT NOT RECOGNISED";
        if (code === ErrorCode.CommandNotRecognised) return "COMMAND NOT RECOGNISED";
        if (code === ErrorCode.CharacterAfterCommand) return "CHARACTER AFTER COMMAND PARAMETERS";
        if (code === ErrorCode.CharacterAfterStatement) return "CHARACTER AFTER END OF STATEMENT.";
        if (code === ErrorCode.LetterCannotDelimitCommand) return "LETTER CANNOT DELIMIT COMMAND NAME.";
        return code;
    }

    private static set_error = ErrorCode.NoError;

    public static set(s : string) { ErrorCode.set_error = s; }
    public static get() { return ErrorCode.set_error; }
}

