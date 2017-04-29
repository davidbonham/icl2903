/// <reference path="bif.ts" />

abstract class Channel {
    // A Channel represents an I/O stream. Currently, we have two subclasses:
    //
    // TerminalChannel does non-interactive I/O to terminal format files accessed
    // using PRINT and INPUT (as opposed to binary, fomatted files accessed using
    // READ and WRITE)
    //
    // TTYChannel does interactive input with the user's TTY

    // The MARGIN statement sets the channel width. There's a documented limit:
    public static readonly MAX_MARGIN = 124

    // We'll need to know if we're interactive or not
    protected _is_terminal : boolean

    // Has an interrupt been generate on this device?
    public abstract interrupt() : boolean

    public abstract close() : void;
}


type FormattedFields = {overflow: boolean; paddedLeadingDigits : string, paddedTrailingDigits: string, exponentField: string}

abstract class TerminalChannel extends Channel
{
    protected _offset : number
    protected _nlPending : boolean
    protected _format_list : string[]
    protected _next_format_list_item : number
    protected _do_trace : boolean
    protected _margin : number
    protected  _buffer : string;

    public constructor() {
        super()
        this._offset = 0;
        this._margin = 72;
        this._nlPending = false;
        this._format_list = null;
        this._is_terminal = true;
        this._do_trace = false;
        this._buffer = "";
    }

    public comma() : void {

        // Has no effect if we are bing controlled by a PRINT USING
        if (this._format_list == null) {
            // A comma is equivalent to tabbing to the next multiple of 15 so we need
            // to advance the offset until offset+1 is a multiple of 15. We print at
            // least one space.
            this.wrch(" ")
            while (((this._offset + 1) % 15) != 0) {
                this.wrch(' ');
            }
        }

        // New line not pending
        this._nlPending = false;
    }

    public semi() : void  {
        this._nlPending = false;
    }


    public tab(column: number) : void {

        // Has no effect if we are being controlled by a PRINT USING
        if (this._format_list == null) {
            // Judging from my CURVES program, we expect a tab to earlier in
            // the line to start a new line
            if (this._offset > column) {
                this.eol();
            }

            while (this._offset < column) {
                this.wrch(' ');
            }
            this._nlPending = true;
        }
    }

    private characteriseFormat(format: string) : Utility.Characteristics
    {
        let before = 0;
        let after = 0;
        let plus = false;
        let minus = false;
        let exponent = false;
        let isDecimal = false;
        let zeroFill = false;
        for (const ch of format) {
            if (ch == '+') {
                plus = true;
            }
            else if (ch == '-') {
                minus = true;
            }
            else if (ch == '#' || ch == '@') {
                if (isDecimal)
                    after += 1;
                else
                    before += 1;

                if (ch == '@')
                    zeroFill = true;
            }
            else if (ch == '.') {
                isDecimal = true;
            }
            else if (ch == '^') {
                exponent = true;
            }
        }

        return {before: before, after: after, plus: plus, minus: minus, exponent: exponent, isDecimal: isDecimal, zeroFill: zeroFill}
    }


    public formatNumber(value: number) : void {
        let formatted = "";

        if (this._format_list != null) {

            // There is a format, so there should be an element remaining for us
            if (this._next_format_list_item >= this._format_list.length)
                throw new Utility.RunTimeError(ErrorCode.PrintUsing)

            // There is an outstanding format item so we use it for this number Make
            // sure it's a numeric format - it must contain a single + or - and that
            // character must be followed by a number of # or @ characters and
            // optionally ^^^^.
            const format = this._format_list[this._next_format_list_item];
            this._next_format_list_item += 1

            // Make a first pass over the format string counting the number of digits
            // before and after any decimal point
            const c = this.characteriseFormat(format)

            // If we didn't see a plus or a minus, this isn't a numeric format
            if (!c.minus && !c.plus)
                throw new Utility.RunTimeError(ErrorCode.PrintUsing)

            formatted = Utility.formatNumber(c, value)
        }
        else {
            // Numbers are printed with a leading - or space and a trailing space. The
            // space after the % handles the former, the trailing one the latter.
            formatted = (value < 0 ? "" : " ") + BIF.str$.call(value) + ' ';
        }
        this.writes(formatted);
        this._nlPending = true;
    }

    public text(value: string)
    {
        // Assume the value we print is the unformatted string
        let formatted = value;

        if (this._format_list != null)
        {
            if (this._next_format_list_item >= this._format_list.length)
                throw new Utility.RunTimeError(ErrorCode.PrintUsing)

            // Search through the format looking for the introductory < or >
            const format = this._format_list[this._next_format_list_item]
            this._next_format_list_item += 1

            const bra = format.indexOf('<')
            const ket = format.indexOf('>')
            const first = bra == -1 ? ket : ket == -1 ? bra : bra < ket ? bra : ket;

            // No > or < so not a string format
            if (first == -1) throw new Utility.RunTimeError(ErrorCode.PrintUsing);

            // Count the number of hashes following the introductory character and add
            // one for the introducer itself
            const format_length = format.split("#").length

            const isLeftJustified = format[first] == '<';
            const string_length = value.length;

            let adjusted_string = "";

            if (string_length > format_length) {
                // The string is too long for the format. Fill the field with asterisks
                adjusted_string = "*".repeat(format_length)
            }
            else {
                // The string fits in the field but may need padding with some spaces
                const padding = " ".repeat(format_length - string_length)
                adjusted_string = isLeftJustified ? value + padding : padding + value;
            }

            // Now loop through the format, replacing the <># characters with the next
            // character from the adjusted string
            formatted = "";
            var adjusted_next = 0;
            for(const format_char of format) {
                if (format_char == '<' || format_char == '>' || format_char == '#') {
                    formatted += adjusted_string[adjusted_next];
                    adjusted_next += 1;
                }
                else {
                    formatted += format_char;
                }
            }
        }

        this.writes(formatted);
        this._nlPending = true;
    }

    public begin() : void {
        wto("begin");
        this._nlPending = true;

        // Remove any previous format, even if it is empty, so we can tell if one is
        // set by this print statement
        this._format_list = null;
    }

    public end() : void {
        wto("end nlpending=" + this._nlPending)
        // If there is a new-line pending at the end of this PRINT statement, it's
        // time to output it otherwise keep things as they are for the next PRINT
        // statement to continue
        if (this._nlPending)
        {
            this.wrch('\n');
            this.eol();
        }

        // There shouldn't be any print format items left over
        if (this._format_list != null && this._next_format_list_item < this._format_list.length)
            throw new Utility.RunTimeError(ErrorCode.PrintUsing);
    }

    public setFormat(format_string: string) : void {

        // This regular expression matches a format specified in the string. Because
        // the first format specifier included all of the leading text, we allow
        // optional text before the format introducer.
        var format_pattern = /[^<>+=-]*[<>+-][^<>+-]*/g;

        // Split the format up into its elements. For example, if the format
        // string is "<## hello ## world <### again <###", the resulting
        // array will be ["<## hello ## world ", "<### again ", "<###"]
        this._format_list = []
        let match : any
        while (match = format_pattern.exec(format_string)) {
            this._format_list.push(match[0])
        }

        // Position to process the first item
        this._next_format_list_item = 0;
    }

    public close() : void {
        wto("close")
        // We're closing this channel so if there is output pending, add a
        // new line before we flush the current output.
        if (this._offset > 0) this.wrch('\n');
        this.eol();

        // Implementation specific close
        this.terminal_close();
    }

    public wrch(ch: string): void {

        // The characters we are displaying are all in the ICL character
        // set so the only carriage control is the new line character. If
        // this character is a new line, flush the current buffer (with the
        // new line) and start again. If this character takes us past the
        // margin and is not a new line, flush as well.
        if (ch == '\n' || this._offset == this._margin) {

            // Either a new line or taken past the margin so start a new
            // line
            wto("wrch new line because lf=" + (ch == '\n') + " offset=" + this._offset)
            this._buffer += "\n";
            this.eol();
        }

        // If the character is a new line, we've already handled it. If not,
        // deal with it here.
        if (ch != '\n') {
            this._buffer += ch
            this._offset++;
        }
    }

    public writes(a_string: string) : void {
        // For now, no optimisation
        wto("writes '" + a_string + "'")
        for (const ch of a_string) this.wrch(ch);
    }

    public  eol() : void {
        wto("eol")
        this.flush(this._buffer);
        this._nlPending = false;
        this._offset = 0;
        this._buffer = "";
    }

    public  margin(m: number) : void {
        // Assume margin takes effect when we start the next line
        this._margin = m;
    }

    public get_margin(): number {
        return this._margin;
    }

    public readline() : string {

        // We must flush the current output to make sure any prompt appears.
        // Typically, this will not end with a newline but because the user
        // will type one when entering their input, we will end up at the
        // start of the next line anyway, so eol will work;
        this.eol();
        return this.get_line();
    }

    // Subclasses are responsible for displaying the buffer when it is time.
    // This may be because we have reached a new line character, hit the
    // margin, need to display a prompt for input or the channel is being
    // closed.
    protected abstract flush(buffer: string) : void

    // Get a record from the device.
    protected abstract get_line() : string

    // Perform any device-specific closure - eg closing a file.
    protected abstract terminal_close() : void

}

class TTYChannel extends TerminalChannel {

    public constructor(protected readonly session: Session.Session) {
       super()
    }

    protected flush(buffer: string) : void {
        wto("flush")
        this.session.print(buffer);
    }

    protected get_line() : string {
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }

    public interrupt() : boolean {
        throw new Utility.RunTimeError(ErrorCode.BugCheck)
    }

    protected terminal_close() : void {
    }
}


enum Access { READ, WRITE, INPUT, PRINT, CLOSE }

class Channels {

        protected static readonly MAX_CHANNEL = 128
        protected channelMap: Channel[]

        public constructor() {
            this.channelMap = []
        }

        public set(index: number, channel: Channel) {
            this.channelMap[index] = channel;
        }

        public get(index: number) : Channel {
            return this.channelMap[index];
        }

        public closeChannels() : void {
            for (const channel of this.channelMap) {
                channel.close();
            }
        }

        public index(channel: number, access: Access) : number {

            // Make sure the expression is a legal int before we attempt to
            // cast it
            if (channel < 0.0 || Channels.MAX_CHANNEL < channel) {
                throw new Utility.RunTimeError(ErrorCode.BadChannel);
            }

            if (!this.channelMap[channel]) {
                throw new Utility.RunTimeError(ErrorCode.FileNotOpen);
            }

            return channel;
        }

}