
namespace Terminal
{
    class Sounds {

        protected soundBuffers : {[key: string] : AudioBuffer}
        protected audioContext : AudioContext

        constructor() {
            this.audioContext = new AudioContext
            this.soundBuffers = {}
            this.loadAll()
        }

        protected load(key: string, uri: string) {

            let request = new XMLHttpRequest();
            request.open('GET', uri, true);
            request.responseType = 'arraybuffer';
            request.onload = () => {
                let bufferarray = this.audioContext.decodeAudioData(
                    request.response,
                    (theBuffer) => this.soundBuffers[key] = theBuffer,
                    () => console.log("ERROR failed to load audio data")
                )
                console.log("loaded " + uri + " as " + key);
            }

            request.send();
            console.log("sent " + uri)
        }

        protected loadAll() {
            this.load('space',    'silence.wav');
            this.load('carriage', 'travelling.wav');
            this.load('keyclick', 'typeonce.wav');
            this.load('print',    'printonce.wav');
            this.load('crlf',     'crlf.wav');
        }

        public playSound(key: string, when: number, loop: boolean, onended: (this: AudioBufferSourceNode, ev: MediaStreamErrorEvent) => any) {

            let source : AudioBufferSourceNode = this.audioContext.createBufferSource()
            source.buffer = this.soundBuffers[key];
            source.loop = loop;
            if (onended) {
                source.onended = onended;
            }
            source.connect(this.audioContext.destination);
            //console.log('playSound ' + key + ' after ' + when + ' at ' + (context.currentTime+when));
            source.start(this.audioContext.currentTime + when);
        }

    }

    // The result expected to be yielded by a session handler. Are we to
    // appear busy to the user and a sequence of printable elements that
    // are to be printed but can be discarded if interrupted. The handler
    // is not to be invoked again until output is complete.
    export enum OutputType {Echo, NoEcho, Print, PrintLn}
    export type Output = {kind : OutputType; text?: string}
    export type HandlerResult = {busy: boolean; output?: Output[]}

    class Keyboard {

        private processKeyEvent(key_event : KeyboardEvent, is_ctrl : boolean, ch : string) : boolean {

            ch = ch.toUpperCase();
            if (is_ctrl) {

                // Control characters that interrupt. Ignore the others
                if (ch == "A" || ch == "C" || ch == "X") {
                    this.terminal.addCharacter(ch, true)
                }
            }
            else if ("\b\r ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"$%^&*()-+=[];:@'#<>,.?/".indexOf(ch) != -1) {
                // A character to be found on the teletype keyboard
                this.terminal.addCharacter(ch, false);
            }

            return false;
        }

        constructor(private terminal: Terminal, private tty: HTMLTextAreaElement) {

            // Set up the callbacks for the interesting keyboard events. When these
            // events identify a character or interrupt, they will pass it to the
            // terminal
            this.tty.onkeypress = (event : KeyboardEvent) => {
                if (terminal.debug) console.log('onkeypress ' + event);
                if (!event.ctrlKey) {
                    this.processKeyEvent(event, false, String.fromCharCode(event.which));      // All others
                }
                event.preventDefault();
                event.stopPropagation();
                event.returnValue = false;
                return false;
            }

            this.tty.onkeydown = (event : KeyboardEvent) => {
                if (terminal.debug) console.log('onkeydown ' + event);

                let block = false;

                if (event.ctrlKey) {
                    // Ignore the control key down event itself and just process any
                    // characters typed while it is down.
                    if (event.which != 17) {
                        this.processKeyEvent(event, true, String.fromCharCode(event.which))
                        block = true;
                    }
                }
                // return is seen in the onkeypress handler
                //else if (event.which == 13) {
                //    // Return key
                //    this.processKeyEvent(event, false, String.fromCharCode(event.which));
                //    block = true;
                //}
                else if (event.which == 8) {
                    // Backspace key
                    this.processKeyEvent(event, false, String.fromCharCode(event.which));
                    block = true;
                }

                // We've handled this event
                if (block) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.returnValue = false;
                }
                return !block;
            }
        }
    }

    class Printer {
        constructor(private tty: HTMLTextAreaElement) {
            this.doEcho = false;
        }

        public clear() : void {
            this.tty.value = "";
            this.tty.scrollTop = this.tty.scrollHeight;
        }

        /**
         * Print out the string on the current line. We don't return to the
         * caller until the device has finished printing - for example, as we
         * print at ten characters per second, "hello world" will not return
         * until eleven seconds have passed.
         *
         * @param text
         */
        print(text: string) : void {

            // This is a stub implementation which ignores the timing and
            // displays the text immediately
            if (this.doEcho) {
                for (let ch of text) {
                    // Convert dollars to pounds in a UK teletype font
                    if (ch === '$') ch = 'l';
                    this.tty.value += ch;
                    this.tty.scrollTop = this.tty.scrollHeight;
                }
            }
        }

        println(text : string) : void {
            this.print(text + "\n");
        }

        // Whether or not to actually print the character (but we will still
        // generate the keyprcess noise). This allows us to hide the entry of
        // passwords, for example
        doEcho : boolean;
        get echo() : boolean     { return this.doEcho;}
        set echo(value: boolean) { this.doEcho = value;}
    }

    export const enum EventKind {None, Quit, Line, Interrupt}
    export interface QuitEvent { kind: EventKind.Quit }
    export interface NoEvent   { kind: EventKind.None }
    export interface LineEvent { kind: EventKind.Line; text : string }
    export interface InterruptEvent  { kind: EventKind.Interrupt; interrupt : string}
    export type Event = QuitEvent | NoEvent | LineEvent | InterruptEvent

    function isHTMLTextAreaElement (element: HTMLElement) : element is HTMLTextAreaElement {
        return element instanceof HTMLTextAreaElement
    }

    export class Terminal {

        /**
         * Construct a new terminal object
         *
         * @param name  the name of an HTMLTextAreaElement to be used to display
         */
        constructor(id : string) {
            let tty = document.getElementById(id);
            if (isHTMLTextAreaElement(tty)) {

                // Wire up the terminal components
                this.printer = new Printer(tty);
                this.keyboard = new Keyboard(this, tty);
                this.output = new OutputAccumulator

                // Set up the audio and load the samples from the server
                this.sounds = new Sounds

                // Look for the optional UI elements
                this.debugToggle = <HTMLInputElement>document.getElementById("debug");
                this.busyRadio = <HTMLInputElement>document.getElementById("busy");
                this.echoRadio = <HTMLInputElement>document.getElementById("echo");
                this.clearButton = <HTMLButtonElement>document.getElementById("clear");
                this.resetButton = <HTMLButtonElement>document.getElementById("reset");
                this.busyRadio.onclick = () => {};
                this.echoRadio.onclick = () => {};
                this.clearButton.onclick = () => this.printer.clear();
                this.resetButton.onclick = () => this.reset();

                this.reset();
                this.busy = false;
                this.updateUI();

            }
            else {
                throw "DOM element with id " + id + " is not an HTMLTextAreaElement";
            }
        }

        private updateUI() : void {
            this.busyRadio.checked = this.busy;
            this.echoRadio.checked = this.printer.echo;
            this.debug = this.debugToggle.checked
        }

        private reset() : void {
            this.lineBuffer = "";
            this.busy = true;
            this.printer.echo = true;
            this.printer.clear();
            this.updateUI();
            this.debug = false;
        }

        private processHandlerResult(result : HandlerResult) : void {

            this.busy = result.busy
            for (const op of this.output.finish()) {
                switch (op.kind) {
                    case OutputType.Echo:
                        this.printer.echo = true
                        break;
                    case OutputType.NoEcho:
                        this.printer.echo = false
                        break;
                    case OutputType.Print:
                        this.printer.print(op.text)
                        break;
                    case OutputType.PrintLn:
                        this.printer.println(op.text)
                        break;
                }
            }
            this.output = new OutputAccumulator
            this.updateUI()
        }

        private generateEvent(event: Event) : void {
            if (this.currentHandler !== undefined) {
                wto("Terminal.generateEvent calls next with " + event.kind)
                const result = this.currentHandler.next(event)
                wto("Terminal.generateEvent received result done=" + result.done + " value=" + result.value)
                this.processHandlerResult(result.value)

                if (result.done) {
                    const nextHandler = this.pendingHandler
                    this.pendingHandler = undefined
                    if (nextHandler != undefined) {
                        wto("Terminal.generateEvent set handler to next")
                        this.setHandler(nextHandler)
                    }
                }
            }
        }

        public addCharacter(character: string, isInterrupt: boolean = false) {

            console.log("addCharacter '" + character + "' code=" + character.charCodeAt(0) + " isInterrupt=" + isInterrupt);
            if (isInterrupt) {
                // If there is pending input, we discard it and indicate this to
                // the user by displaying ' /x/' on the current line where x is
                // the interrupt character (C or Z). If we are busy, then there
                // won't be anything to discard.
                if (this.lineBuffer !== "") {
                    this.printer.println(" /" + character + "/");
                    this.lineBuffer = "";
                }
                this.generateEvent({kind: EventKind.Interrupt, interrupt: character})
            }
            else if (!this.busy) {

                if (character === "\b") {
                    // Erase the last character and display the back-arrow rubout
                    // character
                    if (this.lineBuffer != "") {
                        this.lineBuffer = this.lineBuffer.slice(0, -1);
                        character = '_'
                        this.printer.print(character)
                    }
                }
                else if (character == "\r") {
                    this.printer.print(character)
                    this.generateEvent({kind: EventKind.Line, text: this.lineBuffer})
                    this.lineBuffer = "";
                }
                else {
                    this.lineBuffer += character;
                    this.printer.print(character)
                    this.sounds.playSound("print", 0, false, undefined)
                 }
           }
            else {
                // We are busy so we discard any non-interrupt keys
            }
        }

        // Is the session busy? If so, keyboard input is not being accepted
        // unless it is an interrupt.
        private busy : boolean;
        public debug : boolean;

        private keyboard   : Keyboard
        public  printer    : Printer
        private lineBuffer : string
        protected sounds   : Sounds

        // Optional controls
        private busyRadio : HTMLInputElement;
        private debugToggle : HTMLInputElement;
        private echoRadio : HTMLInputElement;
        private clearButton : HTMLButtonElement;
        private resetButton : HTMLButtonElement;

        private output : OutputAccumulator

        public print(text: string) {
            this.output.print(text)
        }

        public println(text: string) {
            this.output.println(text)
        }

        public echo() {
            this.output.echo()
        }

        public noecho() {
            this.output.noecho()
        }


        private currentHandler: IterableIterator<HandlerResult>
        private pendingHandler: IterableIterator<HandlerResult>

        public setHandler(handler: IterableIterator<HandlerResult>) {
            this.currentHandler = handler;
            wto("Terminal.setHandler priming handler")
            const result = this.currentHandler.next({kind: EventKind.None})
            this.processHandlerResult(result.value)
            wto("Terminal.setHandler received busy=" + this.busy)
        }

        public setPendingHandler(handler: IterableIterator<HandlerResult>) {
            this.pendingHandler = handler;
        }
    }

    class OutputAccumulator {

        constructor(private pendingOutput: Output[] = []) {}

        echo(): void {
            this.pendingOutput.push({kind: OutputType.Echo})
        }

        noecho(): void {
            this.pendingOutput.push({kind: OutputType.NoEcho})
        }

        println(text: string)
        {
            this.pendingOutput.push({kind: OutputType.PrintLn, text: text})
        }

        print(text: string)
        {
            this.pendingOutput.push({kind: OutputType.Print, text: text})
        }

        finish () : Output[] {
            const current = this.pendingOutput
            this.pendingOutput = []
            return current
        }
    }


}

