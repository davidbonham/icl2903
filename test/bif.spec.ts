/// <reference path="../bif.ts" />

describe("strS", () => {

    it("tiny negative", () => expect(
        BIF.str$.call(-1e-6)
    ).toBe("-1E-6"))

    it("tiny negative fraction", () => expect(
        BIF.str$.call(-1.5e-6)
    ).toBe("-1.5E-6"))

    it("small negative", () => expect(
        BIF.str$.call(-1e-2)
    ).toBe("-1E-2"))

    it("large negative", () => expect(
        BIF.str$.call(-1e+2)
    ).toBe("-100"))

    it("huge negative", () => expect(
        BIF.str$.call(-1e+6)
    ).toBe("-1E6"))

    it("huge negative fraction", () => expect(
        BIF.str$.call(-1.5e+6)
    ).toBe("-1.5E6"))

    it("trims leading zero on positive", () => expect(
        BIF.str$.call(0.1)
    ).toBe(" .1"))

    it("trims leading zero on negative", () => expect(
        BIF.str$.call(-0.1)
    ).toBe("-.1"))

    it("trims leading dp on integer", () => expect(
        BIF.str$.call(123)
    ).toBe(" 123"))

    it("has no more than six digits", () => expect(
        BIF.str$.call(2/3)
    ).toBe(" .666667"))

    it("has no more than six digits", () => expect(
        BIF.str$.call(-2/3)
    ).toBe("-.666667"))

    it("has no more than six digits with exponent", () => expect(
        BIF.str$.call(20000000/3)
    ).toBe(" 6.66667E6"))

    it("has no more than six digits with exponent", () => expect(
        BIF.str$.call(-20000000/3)
    ).toBe("-6.66667E6"))

})
