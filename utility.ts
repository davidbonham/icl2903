namespace Utility {

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
}