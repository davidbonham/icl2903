namespace Utility {

    /**
     * Some operations in BASIC convert their value to an integer by rounding
     * rather than truncation. We capture the rounding method here so we
     * can use this function to indicate the value is being rounded for
     * BASIC
     *
     * @param value     the value to round
     */
    export function round(value: number) : number {
        return Math.floor(value + 0.5)
    }

    export function padInteger(value: number, width: number, char: string) : string {
        return (char.repeat(width) + round(value)).slice(-width)
    }

    export function basicDate(date : Date) : string  {

        // For items that can be one or two characters, prefix with a 0
        // and take the last two characters. Note that month is 0-based
        const dd = ("0" + date.getDate()).slice(-2);
        const mm = ("0" + (date.getMonth()+1)).slice(-2);
        const yy = date.getFullYear().toString().slice(-2);

        return dd+"/"+mm+"/"+yy
    }

    export function basicTime(date : Date) : string  {

        // For items that can be one or two characters, prefix with a 0
        // and take the last two characters
        const hh = ("0" + date.getHours()).slice(-2);
        const mm = ("0" + date.getMinutes()).slice(-2);
        const ss = ("0" + date.getSeconds()).slice(-2);

        return hh+":"+mm+":"+ss
    }

    export function isLetter(character : string) : boolean {
        return "A" <= character && character <= "Z"
    }

    export function isDigit(character : string) : boolean {
        return "0" <= character && character <= "9"
    }

    export function isSpace(character: string) : boolean {
        return character === ' ' || character === '\t'
    }

    export class RunTimeError {
        constructor(public readonly error: string, public readonly line?: number){}
    }

    export type Characteristics = {
        before    : number      // Places before decimal point, excluding sign
        after     : number      // Places after the decimal point
        plus      : boolean     // +/- in the first place
        minus     : boolean     // space/- in the first place
        exponent  : boolean     // Must have E+nn or E-nn
        isDecimal : boolean     // Force a decimal point
        zeroFill  : boolean     // Pad before and after with zeros
    }

    export function formatNumber(c: Characteristics, n: number) : string {

        // For a number with an exponent field, we need to reduce the value
        // into the range 0 <= n < 10 and calculate the corresponding power
        // of ten.
        let power : number
        let exponent: string = ""
        let whole: string = undefined
        let fraction: string = undefined
        const negative: boolean = n < 0
        const isDecimal = c.isDecimal || c.after > 0

        if (c.exponent) {
            const exp = n.toExponential()
            let mantissa : string
            [mantissa, exponent] = exp.split("e");
            [whole, fraction] = mantissa.split(".");
        }
        else {
            [whole, fraction] = n.toFixed(c.after).split('.')
        }

        console.log("whole=" + whole + " fraction=" + fraction + " exponent=" + exponent)

        // If negative, trim off the leading sign
        if (negative) whole = whole.substring(1)

        let output = ""

        // If there are too many leading digits, we have overflowed the format
        // (For the exponent, if there is none it is "" otherwise it is +nnnnnn
        // and any more than exponent digits is an overflow)
        const overflow = whole.length > c.before || exponent.length > 3
        if (overflow) {
            // Fill entire field with stars. If the fraction part is zero,
            // there may still be a space for a decimal point if forced.
            const wholeWidth = c.before + 1
            const fractionWidth = (isDecimal ? 1 : 0) + c.after

            output += "*".repeat(wholeWidth + fractionWidth + (c.exponent ? 4 : 0))
        }
        else {
            // Pad the whole part with leading spaces or zeros as instructed
            const leadingPadding = (c.zeroFill ? '0' : ' ').repeat(c.before - whole.length)

            // Start with the sign or space at the start
            output +=  negative ? '-' : c.plus ? '+' : ' '

            // Add the whole part, padded with zeros or spaces
            output += leadingPadding + whole

            // Add the decimal point if there is one
            if (isDecimal) output += '.'

            if (fraction != undefined) {
                // Pad the fraction with trailing zeros
                if (fraction.length < c.after) fraction += '0'.repeat(c.after - fraction.length)

                // Take the required number of decimal places
                output += fraction.substring(0, c.after)
            }

            // If there is an exponent, add it. We take the sign and pad the
            // digit to two if needed
            if (c.exponent) {
                output += 'E' + exponent[0]
                output += (exponent.length == 2) ? '0' + exponent[1] : exponent.substring(1)
            }
        }

        return output
    }

    export function buckets(bytes: number) : number {
        const result = (bytes + 3 * 128 - 1) / (3 * 128)
        return Math.floor(result)
    }
    export function bugcheck(reason: string) {
        console.log("------------------------------- BUG CHECK ------------------------------")
        console.log(reason)
        console.log("")
        console.log("CALL STACK")
        console.log("")
        console.log(new Error().stack)
        console.log("")
        console.log("------------------------------------------------------------------------")
    }

}