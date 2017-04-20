/// <reference path="../scanner.ts" />

describe("Token", () => {
    it("sets the right type for token", () => expect( (new Token(TokenType.EQ, "=")).type ).toBe(TokenType.EQ))
    it("sets the right text for token", () => expect( (new Token(TokenType.SID, "A$")).text ).toBe("A$"))
})

describe("Skipping", () => {

    let error = new ErrorCode
    let skip = new Scanner("< +  / ")
    it("skips no space",   () => expect( skip.consumeSymbol(TokenType.LT) ).toBe(true))
    it("skips one space",  () => expect( skip.consumeSymbol(TokenType.ADD) ).toBe(true))
    it("skips two spaces", () => expect( skip.consumeSymbol(TokenType.DIV) ).toBe(true))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Symbols", () => {

    let error = new ErrorCode
    let symbols = new Scanner("< = <= > = >= <> = # * ** ! ^ & () [] ;:,? +-/")

    it("recognises <",     () => expect ( symbols.consumeSymbol(TokenType.LT)   ).toBe(true))
    it("scans one char",   () => expect ( symbols.current().text                ).toBe("<"))
    it("recognises =",     () => expect ( symbols.consumeSymbol(TokenType.EQ)   ).toBe(true))
    it("recognises <=",    () => expect ( symbols.consumeSymbol(TokenType.LE)   ).toBe(true))
    it("scans both chars", () => expect ( symbols.current().text                ).toBe("<="))
    it("recognises >",     () => expect ( symbols.consumeSymbol(TokenType.GT)   ).toBe(true))
    it("recognises =",     () => expect ( symbols.consumeSymbol(TokenType.EQ)   ).toBe(true))
    it("recognises >=",    () => expect ( symbols.consumeSymbol(TokenType.GE)   ).toBe(true))
    it("scans both chars", () => expect ( symbols.current().text                ).toBe(">="))
    it("recognises <>",    () => expect ( symbols.consumeSymbol(TokenType.NE)   ).toBe(true))
    it("scans both chars", () => expect ( symbols.current().text                ).toBe("<>"))
    it("recognises =",     () => expect ( symbols.consumeSymbol(TokenType.EQ)   ).toBe(true))
    it("recognises #",     () => expect ( symbols.consumeSymbol(TokenType.HASH) ).toBe(true))
    it("recognises *",     () => expect ( symbols.consumeSymbol(TokenType.MUL)  ).toBe(true))
    it("recognises **",    () => expect ( symbols.consumeSymbol(TokenType.POW1) ).toBe(true))
    it("scans both chars", () => expect ( symbols.current().text                ).toBe("**"))
    it("recognises !",     () => expect ( symbols.consumeSymbol(TokenType.SEP)  ).toBe(true))
    it("recognises ^",     () => expect ( symbols.consumeSymbol(TokenType.POW2) ).toBe(true))
    it("recognises &",     () => expect ( symbols.consumeSymbol(TokenType.CAT)  ).toBe(true))
    it("recognises (",     () => expect ( symbols.consumeSymbol(TokenType.PAR)  ).toBe(true))
    it("recognises )",     () => expect ( symbols.consumeSymbol(TokenType.REN)  ).toBe(true))
    it("recognises [",     () => expect ( symbols.consumeSymbol(TokenType.BRA)  ).toBe(true))
    it("recognises ]",     () => expect ( symbols.consumeSymbol(TokenType.KET)  ).toBe(true))
    it("recognises ;",     () => expect ( symbols.consumeSymbol(TokenType.SEMI) ).toBe(true))
    it("recognises :",     () => expect ( symbols.consumeSymbol(TokenType.COLON) ).toBe(true))
    it("recognises ,",     () => expect ( symbols.consumeSymbol(TokenType.COMMA) ).toBe(true))
    it("recognises ?",     () => expect ( symbols.consumeSymbol(TokenType.QUES) ).toBe(true))
    it("recognises +",     () => expect ( symbols.consumeSymbol(TokenType.ADD)  ).toBe(true))
    it("recognises -",     () => expect ( symbols.consumeSymbol(TokenType.SUB)  ).toBe(true))
    it("spots unexpected", () => expect ( symbols.consumeSymbol(TokenType.HASH) ).toBe(false))
    it("recognises /",     () => expect ( symbols.consumeSymbol(TokenType.DIV)  ).toBe(true))
    it("handles empty",    () => expect ( symbols.consumeSymbol(TokenType.HASH) ).toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Numbers", () => {

    let numbers = new Scanner("1 23 456 -7 +8 0123456789 .1 2.3 0.")

    it("recognises single digit",  () => expect ( numbers.consumeNumber()       ).toBe("1"))
    it("recognises two digits",    () => expect ( numbers.consumeNumber()       ).toBe("23"))
    it("recognises three digits",  () => expect ( numbers.consumeNumber()       ).toBe("456"))
    it("recognises negative sign", () => expect ( numbers.consumeNumber()       ).toBe("-7"))
    it("recognises positive sign", () => expect ( numbers.consumeNumber()       ).toBe("+8"))
    it("recognises all digits",    () => expect ( numbers.consumeNumber()       ).toBe("0123456789"))
    it("recognises leading .",     () => expect ( numbers.consumeNumber()       ).toBe(".1"))
    it("recognises embeded .",     () => expect ( numbers.consumeNumber()       ).toBe("2.3"))
    it("ignores illegal trailing .",    () => expect ( numbers.consumeNumber()       ).toBe("0"))
    it("spots illegal .",          () => expect ( numbers.consumeNumber()       ).toBe(undefined))

    let exps = new Scanner("1E2 -3E4 5E-6 -7E-8 12.34E+56")

    it("recognises unsigned exponent", () => expect( exps.consumeNumber()   ).toBe("1E2"))
    it("recognises negative mantissa", () => expect( exps.consumeNumber()   ).toBe("-3E4"))
    it("recognises negative exponent", () => expect( exps.consumeNumber()   ).toBe("5E-6"))
    it("recognises double negative",   () => expect( exps.consumeNumber()   ).toBe("-7E-8"))
    it("recognises positive exponent", () => expect( exps.consumeNumber()   ).toBe("12.34E+56"))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Unquoted data elements", () => {

    let seq1 = new Scanner("1, 2,3 ,HELLO , WORLD,WHAT IS UP,QUOTE\"UNQUOTE,*,)$")

    it("handles no leading space",    () => expect(seq1.consumeUnquoted()       ).toBe(true))
    it("                   value",    () => expect(seq1.current().text          ).toBe("1"))
    it("                   type ",    () => expect(seq1.current().type          ).toBe(TokenType.UNQ))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles leading space",       () => expect(seq1.consumeUnquoted()       ).toBe(true))
    it("                value",       () => expect(seq1.current().text          ).toBe("2"))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles trailing space",    () => expect(seq1.consumeUnquoted()         ).toBe(true))
    it("                 value",    () => expect(seq1.current().text            ).toBe("3 "))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles string before ,",   () => expect(seq1.consumeUnquoted()         ).toBe(true))
    it("                   value",  () => expect(seq1.current().text            ).toBe("HELLO "))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles string after ,",    () => expect(seq1.consumeUnquoted()         ).toBe(true))
    it("                   value",  () => expect(seq1.current().text            ).toBe("WORLD"))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles unquoted string",   () => expect(seq1.consumeUnquoted()         ).toBe(true))
    it("                  value",   () => expect(seq1.current().text            ).toBe("WHAT IS UP"))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles embedded quote",    () => expect(seq1.consumeUnquoted()       ).toBe(true))
    it("                 value",    () => expect(seq1.current().text          ).toBe("QUOTE\"UNQUOTE"))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles one symbol",        () => expect(seq1.consumeUnquoted()       ).toBe(true))
    it("             value",        () => expect(seq1.current().text          ).toBe("*"))

    it("skips comma again",           () => expect(seq1.consumeSymbol(TokenType.COMMA)) .toBe(true))
    it("handles multiple Symbols",  () => expect(seq1.consumeUnquoted()       ).toBe(true))
    it("                  value",   () => expect(seq1.current().text          ).toBe(")$"))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("BIF Numerics", () => {

    let error = new ErrorCode
    let test = new Scanner("CHR CPI CHR$")

    it("recognises CHR",  () => expect( test.consumeBifn("CHR"))        .toBe(true))
    it("         value",  () => expect( test.current().text)            .toBe("CHR"))

    it("recognises CPI",  () => expect( test.consumeBifn("CPI"))        .toBe(true))
    it("spots bad CHR$",  () => expect( test.consumeBifn("CHR"))        .toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("BIF Strings", () => {

    let test = new Scanner("CHR$ GAP$ DEL$")

    it("recognises CHR$",  () => expect( test.consumeBifs("CHR$"))      .toBe(true))
    it("          value",  () => expect( test.current().text)           .toBe("CHR$"))
    it("recognises GAP$",  () => expect( test.consumeBifs("GAP$"))      .toBe(true))
    it("spots bad MID$",   () => expect( test.consumeBifs("MID$"))      .toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("UDF Strings", () => {

    let test = new Scanner("FNA$ FNZ$ FNB0$ FNY9$ FN_$")

    it("recognises FNA$",  () => expect( test.consumeUdfs())            .toBe(true))
    it("          value",  () => expect( test.current().text)           .toBe("FNA$"))
    it("recognises FNZ$",  () => expect( test.consumeUdfs())            .toBe(true))
    it("recognises FNB0$", () => expect( test.consumeUdfs())            .toBe(true))
    it("          value",  () => expect( test.current().text)           .toBe("FNB0$"))
    it("recognises FNY9$", () => expect( test.consumeUdfs())            .toBe(true))
    it("spots bad FN_$",   () => expect( test.consumeUdfs())            .toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("UDF Numerics", () => {

    let test = new Scanner("FNA FNZ FNB0 FNY9 FN_")

    it("recognises FNA",  () => expect( test.consumeUdfn())            .toBe(true))
    it("         value",  () => expect( test.current().text)           .toBe("FNA"))
    it("recognises FNZ",  () => expect( test.consumeUdfn())            .toBe(true))
    it("recognises FNB0", () => expect( test.consumeUdfn())            .toBe(true))
    it("         value",  () => expect( test.current().text)           .toBe("FNB0"))
    it("recognises FNY9", () => expect( test.consumeUdfn())            .toBe(true))
    it("spots bad FN_",   () => expect( test.consumeUdfn())            .toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Keywords", () => {

    let test = new Scanner("FOR NEXT GO GOTO GO TO")

    it("recognises FOR",  () => expect( test.consumeKeyword("FOR"))     .toBe(true))
    it("         value",  () => expect( test.current().text)            .toBe("FOR"))
    it("         type ",  () => expect( test.current().type)            .toBe(TokenType.KEY))
    it("recognises NEXT", () => expect( test.consumeKeyword("NEXT"))    .toBe(true))
    it("recognises GO",   () => expect( test.consumeKeyword("GO"))      .toBe(true))
    it("        value",   () => expect( test.current().text)            .toBe("GO"))
    it("recognises GOTO", () => expect( test.consumeKeyword("GOTO"))    .toBe(true))
    it("spots bad TO",    () => expect( test.consumeKeyword("GOTO"))    .toBe(false))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Rest of Line", () => {

    let test = new Scanner("the rest! or the line")

    it("recognises rest", () => expect( test.consumeRest())             .toBe(true))
    it("         value",  () => expect( test.current().text)            .toBe("the rest! or the line"))
    it("         type ",  () => expect( test.current().type)            .toBe(TokenType.REM))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Remarks", () => {

    let test1 = new Scanner("REM This is a remark")
    let test2 = new Scanner("REMARK This is a remark")
    let test3 = new Scanner("REM")

    it("recognises rest", () => expect( test1.consumeRemark())           .toBe(true))
    it("         value",  () => expect( test1.current().text)            .toBe("REM This is a remark"))
    it("         type ",  () => expect( test1.current().type)            .toBe(TokenType.REM))

    it("recognises rest", () => expect( test2.consumeRemark())           .toBe(true))
    it("         value",  () => expect( test2.current().text)            .toBe("REMARK This is a remark"))
    it("         type ",  () => expect( test2.current().type)            .toBe(TokenType.REM))

    it("recognises rest", () => expect( test3.consumeRemark())           .toBe(true))
    it("         value",  () => expect( test3.current().text)            .toBe("REM"))
    it("         type ",  () => expect( test3.current().type)            .toBe(TokenType.REM))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Strings", () => {

    let test1 = new Scanner('"STRING1""STRING2""STRING3')
    let test2 = new Scanner('""')

    it("recognises first", () => expect( test1.consumeString())         .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('"STRING1"'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.STR))

    it("recognises 2nd",  () => expect( test1.consumeString())           .toBe(true))
    it("         value",  () => expect( test1.current().text)            .toBe('"STRING2"'))
    it("         type ",  () => expect( test1.current().type)            .toBe(TokenType.STR))

    it("spot no closing", () => expect( test1.consumeString())           .toBe(false))

    it("recognises empty", () => expect( test2.consumeString())           .toBe(true))
    it("         value",   () => expect( test2.current().text)            .toBe('""'))
    it("         type ",   () => expect( test2.current().type)            .toBe(TokenType.STR))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Line Numbers", () => {

    let test1 = new Scanner("1 88 999 9999 12345")
    let test2 = new Scanner("1E4")

    it("recognises 1",     () => expect( test1.consumeLinenumber())     .toBe(1))
    it("         value",   () => expect( test1.current().text)          .toBe('1'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.NUM))

    it("recognises 88",    () => expect( test1.consumeLinenumber())     .toBe(88))
    it("         value",   () => expect( test1.current().text)          .toBe('88'))

    it("recognises 999",   () => expect( test1.consumeLinenumber())     .toBe(999))
    it("         value",   () => expect( test1.current().text)          .toBe('999'))

    it("recognises 9999",  () => expect( test1.consumeLinenumber())     .toBe(9999))
    it("         value",   () => expect( test1.current().text)          .toBe('9999'))

    it("too large 12345",  () => expect( test1.consumeLinenumber())     .toBe(undefined))
    it("non-integer",      () => expect( test2.consumeLinenumber())     .toBe(undefined))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Identfiers", () => {

    let test1 = new Scanner("A Z A0 Z9 A$ Z$ B0$ B9$")

    it("recognises A",     () => expect( test1.consumeNid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('A'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.NID))

    it("recognises Z",     () => expect( test1.consumeNid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('Z'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.NID))

    it("recognises A0",    () => expect( test1.consumeNid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('A0'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.NID))

    it("recognises Z9",    () => expect( test1.consumeNid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('Z9'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.NID))

    it("fails for A$",     () => expect( test1.consumeNid())            .toBe(false))

    it("recognises A$",    () => expect( test1.consumeSid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('A$'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.SID))

    it("recognises Z$",    () => expect( test1.consumeSid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('Z$'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.SID))
    it("recognises B0$",   () => expect( test1.consumeSid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('B0$'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.SID))
    it("recognises B9$",   () => expect( test1.consumeSid())            .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('B9$'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.SID))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))
})

describe("Commands", () => {

    let test1 = new Scanner("? HELP CAT CATALOGUE")
    let test2 = new Scanner("FOO ")
    let test3 = new Scanner("LISTA")

    it("treats ? as help", () => expect( test1.consumeCommand("?"))     .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe('?'))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.CMD))

    it("recognises HELP",  () => expect( test1.consumeCommand("HEL"))   .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe("HELP"))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.CMD))

    it("recognises CAT",   () => expect( test1.consumeCommand("CAT"))   .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe("CAT"))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.CMD))

    it("recognises full",  () => expect( test1.consumeCommand("CAT"))   .toBe(true))
    it("         value",   () => expect( test1.current().text)          .toBe("CATALOGUE"))
    it("         type ",   () => expect( test1.current().type)          .toBe(TokenType.CMD))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))

    it("spots not command",() => expect( test2.consumeCommand("GET"))   .toBe(false))
    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))

    it("spots error",      () => expect( test3.consumeCommand("LIS"))   .toBe(false))
    it("set right error",  () => expect( ErrorCode.get())                   .toBe(ErrorCode.LetterCannotDelimitCommand))

})

describe("Filenames", () => {

    let test1 = new Scanner("A A+B=>C I#BASI $CESIL")

    it("can be single letter",  () => expect (test1.consumeFilename())  .toBe(true))
    it("         value",        () => expect( test1.current().text)     .toBe("A"))
    it("         type ",        () => expect( test1.current().type)     .toBe(TokenType.FIL))

    it("can be six characters", () => expect (test1.consumeFilename())  .toBe(true))
    it("         value",        () => expect( test1.current().text)     .toBe("A+B=>C"))

    it("can contain hash",      () => expect (test1.consumeFilename())  .toBe(true))
    it("         value",        () => expect( test1.current().text)     .toBe("I#BASI"))

    it("can start with $",      () => expect (test1.consumeFilename())  .toBe(true))
    it("         value",        () => expect( test1.current().text)     .toBe("$CESIL"))

    it("set no error",     () => expect( ErrorCode.get())                   .toBe(ErrorCode.NoError))

})

describe("Navigation", () => {

    let test1 = new Scanner('RESTORE!STOP')

    it ("starts not at eos",    () => expect (test1.atEos())            .toBe(false))
    it ("starts not at eol",    () => expect (test1.atEol())            .toBe(false))

    it ("moves to eos",         () => expect( test1.consumeKeyword("RESTORE")) .toBe(true))
    it ("indicates eos",        () => expect( test1.atEos())            .toBe(true))
    it ("indicates not eol",    () => expect( test1.atEol())            .toBe(false))

    it ("returns eos",          () => expect( test1.consumeSymbol(TokenType.SEP)) .toBe(true))
    it ("indicates not eos",    () => expect( test1.atEos())            .toBe(false))
    it ("indicates not eol",    () => expect( test1.atEol())            .toBe(false))

    it ("moves to eol",         () => expect( test1.consumeKeyword("STOP")) .toBe(true))
    it ("indicates eos",        () => expect( test1.atEos())            .toBe(true))
    it ("indicates eol",        () => expect( test1.atEol())            .toBe(true))

})