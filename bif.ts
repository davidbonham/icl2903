/// <reference path="ast.ts" />

namespace BIF {

    export class str$ extends StringExpression {

        public constructor(protected readonly _value: NumericExpression) {
            super()
        }

        public source() : string  {
            return "STR$(" + this._value.source() + ")";
        }

        public value(context: Context) : string {
            // Start by formatting using %g. The space before the g ensures we start
            // with a leading space or minus sign. We want any E in upper case and
            // no plus sign in the exponent
            const n = this._value.value(context);
            return str$.call(n);
        }

        public static call(n: number) : string {

            // We don't display more than six digits. So if the number is
            // 1000000 or greater, we switch to exponential format. By
            // observation, values less that 0.1 are displayed in exponention
            // format too. So: 1E6, 100000, 10000 1000 100 10 1 .1 1E-2 ...
            //
            // Unlike the PRINT statement, we don't generate a leading space
            // for positive values - so "-4" but "4"

            // Get the initial text form
            const hasExponent = n != 0 && Math.abs(n) < 0.1 || 1000000 <= Math.abs(n)
            let number : string;
            let exponent : string
            if (hasExponent) {
                let text = hasExponent ? n.toExponential(5) : n.toPrecision(6);
                [number, exponent] = text.split('e')
            }
            else {
                number = n.toPrecision(6)
                exponent = ""
            }

            console.log("start for n=" + n + " hasExponent=" + hasExponent + " number=" + number + " exponent=" + exponent)
            if (hasExponent) {
                // We don't display the sign of a positive exponent
                exponent = exponent.replace("+", "");
            }

            // If the number starts 0. or -0., remove the leading zero
            number = number.replace(/^(\-?)0\./, '$1.')
            console.log("removed leading zero=" + number);

            // If the number contains digits after the decimal point,
            // remove any trailing zeros
            if (number.indexOf(".") != -1) number = number.replace(/0+$/, "");
            console.log("removed trailing zeros=" + number)

            // If the number ends with a ., remove it
            if (number.endsWith(".")) number = number.slice(0,-1)
            console.log("removed leading .=" + number)

            // If we have removed everything, then we must be zero
            if (number == "") number = "0";
            console.log("handled empty result=" + number)

            return hasExponent ? number + "E" + exponent : number
        }
    }
}
