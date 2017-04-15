function test(text: string) : number | string {

    let errorCode: ErrorCode = new ErrorCode
    let scanner = new Scanner(text, errorCode)
    let ast = NumericExpression.parse(scanner)
    let context : Context = new Context(null, null)
    try {
        return ast.value(context)
    }
    catch (e) {
        return (<Utility.RunTimeError>e).error
    }
}
describe("numeric built-in functions", () => {

    it("sqr positive",           () => expect (test("SQR(4)")).toBeCloseTo(Math.sqrt(4),15))
    it("sqr negative",           () => expect (test("SQR(-4)")).toBe("SQUARE ROOT OF A NEGATIVE NUMBER"))

    it("abs of positive",        () => expect (test("ABS(4)")).toBeCloseTo(4,10))
    it("abs of zero",            () => expect (test("ABS(0)")).toBeCloseTo(0,10))
    it("abs of negative",        () => expect (test("ABS(-4)")).toBeCloseTo(4,10))

    it("atn of positive",        () => expect (test("ATN(1)")).toBeCloseTo(Math.atan(1),15))
    it("atn of zero",            () => expect (test("ATN(0)")).toBeCloseTo(Math.atan(0),15))
    it("atn of negative",        () => expect (test("ATN(-1)")).toBeCloseTo(Math.atan(-1),15))

    it("cos of positive",        () => expect (test("COS(0.7853981633974483)")).toBeCloseTo(Math.cos(0.7853981633974483),15))
    it("cos of zero",            () => expect (test("COS(0)")).toBeCloseTo(Math.cos(0),15))
    it("cos of negative",        () => expect (test("COS(-0.7853981633974483)")).toBeCloseTo(Math.cos(-0.7853981633974483),15))

    it("cpi",                    () => expect (test("CPI")).toBeCloseTo(Math.PI))

    it("eps",                    () => expect (test("EPS")).toBeCloseTo(Number.EPSILON))

    it("inf",                    () => expect (test("INF")).toBeCloseTo(NumericExpression.MAXIMUM))

    it("int of positive int",    () => expect (test("INT(1)")).toBeCloseTo(1))
    it("int of positive",        () => expect (test("INT(1.9)")).toBeCloseTo(1))
    it("int of zero",            () => expect (test("INT(0)")).toBeCloseTo(0))
    it("int of negative int",    () => expect (test("INT(-1)")).toBeCloseTo(-1))
    it("int of negative",        () => expect (test("INT(-1.1)")).toBeCloseTo(-2))

    it("sgn of positive",        () => expect (test("SGN(4)")).toBeCloseTo(1,10))
    it("sgn of zero",            () => expect (test("SGN(0)")).toBeCloseTo(0,10))
    it("sgn of negative",        () => expect (test("SGN(-4)")).toBeCloseTo(-1,10))

    it("sin of positive",        () => expect (test("SIN(0.7853981633974483)")).toBeCloseTo(Math.sin(0.7853981633974483),15))
    it("sin of zero",            () => expect (test("SIN(0)")).toBeCloseTo(Math.sin(0),15))
    it("sin of negative",        () => expect (test("SIN(-0.7853981633974483)")).toBeCloseTo(Math.sin(-0.7853981633974483),15))

})