/// <reference path="../utility.ts" />

describe("format number", () => {

    it("works a bit", () => expect(
        Utility.formatNumber({before:4, after:2, plus: true, minus: false, zeroFill: false, exponent: false, isDecimal: true}, 123)
    ).toBe("+ 123.00"))

    it("simple negative integer +", () => expect(
        Utility.formatNumber({before:4, after:2, plus: true, minus: false, zeroFill: false, exponent: false, isDecimal: true}, -123)
    ).toBe("- 123.00"))

    it("simple positive integer +", () => expect(
        Utility.formatNumber({before:4, after:2, plus: true, minus: false, zeroFill: false, exponent: false, isDecimal: true}, 123)
    ).toBe("+ 123.00"))

    it("simple negative integer -", () => expect(
        Utility.formatNumber({before:4, after:2, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, -123)
    ).toBe("- 123.00"))

    it("simple positive integer -", () => expect(
        Utility.formatNumber({before:4, after:2, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, 123)
    ).toBe("  123.00"))

    it("trailing decimals -", () => expect(
        Utility.formatNumber({before:4, after:2, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, 123.456)
    ).toBe("  123.46"))

    it("long trailing decimals -", () => expect(
        Utility.formatNumber({before:4, after:20, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, 123.456)
    ).toBe("  123.45600000000000306954"))

    it("with decimal point", () => expect(
        Utility.formatNumber({before:4, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, 123)
    ).toBe("  123."))

   it("without decimal point", () => expect(
        Utility.formatNumber({before:4, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, 123)
    ).toBe("  123"))

   it("overflow if no leading zero decimal=false", () => expect(
        Utility.formatNumber({before:0, after:6, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, .123)
    ).toBe("********"))

   it("overflow if no leading zero decimal=true", () => expect(
        Utility.formatNumber({before:0, after:6, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: true}, .123)
    ).toBe("********"))

    it("fills with leading zeros +ve, nothing to fill", () => expect(
        Utility.formatNumber({before:4, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, 1234)
    ).toBe(" 1234"))

    it("fills with leading zeros -ve, nothing to fill", () => expect(
        Utility.formatNumber({before:4, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, -1234)
    ).toBe("-1234"))

    it("fills with leading zeros +ve, two to fill", () => expect(
        Utility.formatNumber({before:6, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, 1234)
    ).toBe("   1234"))

    it("fills with leading zeros -ve, two to fill", () => expect(
        Utility.formatNumber({before:6, after:0, plus: false, minus: true, zeroFill: false, exponent: false, isDecimal: false}, -1234)
    ).toBe("-  1234"))

    it("exponent -ve, two to fill", () => expect(
        Utility.formatNumber({before:2, after:4, plus: false, minus: true, zeroFill: false, exponent: true, isDecimal: false}, 0.01234)
    ).toBe("  1.2340E-02"))

    it("exponent +ve, two to fill", () => expect(
        Utility.formatNumber({before:2, after:4, plus: false, minus: true, zeroFill: false, exponent: true, isDecimal: false}, 123.4)
    ).toBe("  1.2340E+02"))



})
