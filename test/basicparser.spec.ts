describe("commands", () => {

    let bp = new BasicParser

    it("parses bye",           () => expect (bp.parse("BYE") instanceof ByeCmd).toBe(true))
    it("fails on bad command", () => expect (bp.parse("FOO")).toBe(ErrorCode.CommandNotRecognised))
    it("fails on extra input", () => expect (bp.parse("BYE AGAIN")).toBe(ErrorCode.CharacterAfterCommand))
    it("parses ?",             () => expect (bp.parse("?") instanceof QuestionCmd).toBe(true))
})