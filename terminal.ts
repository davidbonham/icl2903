
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
            source.start(this.audioContext.currentTime + when);
        }

        public playCarriage(duration: number) : void {

            // Set up the carriage travelling sound for the duration of the
            // test's printing, looping it as required. We ramp the sound up
            // at the start and down at the end to fade it out as we don't
            // have an idle noise.

            let carriage = this.audioContext.createBufferSource();
            carriage.buffer = this.soundBuffers['carriage'];
            carriage.loop = true;

            var gain = this.audioContext.createGain();
            gain.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + duration);
            gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration + 1);

            carriage.connect(gain);
            gain.connect(this.audioContext.destination);

            var startTime = this.audioContext.currentTime;
            var stopTime = startTime + duration;

            carriage.start(startTime);
            carriage.stop(stopTime);
        }
    }

    // The result expected to be yielded by a session handler. Are we to
    // appear busy to the user and a sequence of printable elements that
    // are to be printed but can be discarded if interrupted. The handler
    // is not to be invoked again until output is complete.
    export enum OutputType {Echo, NoEcho, Print, Crlf, Defer}
    export type Output = {kind : OutputType; text?: string; deferred?: () => void}
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

        protected sounds   : Sounds
        protected printing : boolean
        protected pending  : Output[]

        constructor(private tty: HTMLTextAreaElement) {
            this.doEcho = false;

            // Set up the audio and load the samples from the server
            this.sounds = new Sounds

            // We're not currently printing anything
            this.printing = false
            this.pending = []
            wto("ctor pending=" + this.pending.toString())
        }

        public clear() : void {
            this.tty.value = "";
            this.tty.scrollTop = this.tty.scrollHeight;
        }

        protected printNext() : void {
            wto("printNext pending=" + this.pending.toString() + " echo=" + this.getEcho())
            while (this.pending.length > 0) {
                const item: Output = this.pending.shift()
                if (item.kind === OutputType.Echo) {
                    wto("printNext dequeue ECHO")
                    this.setEcho(true)
                }
                else if (item.kind === OutputType.NoEcho) {
                    wto("printNext dequeue NOECHO")
                    this.setEcho(false)
                }
                else if (item.kind === OutputType.Crlf) {
                    wto("printNext dequeue CRLF echo=" + this.getEcho() + " and return")
                    if (this.getEcho()) {
                        this.playText("\n")

                        // Stop dequeueing elements until the current one
                        // completes - it will call printNext again.
                        return
                    }
                }
                else if (item.kind == OutputType.Print) {
                   wto("printNext dequeue PRINT '" + item.text + "' echo=" + this.getEcho() + " and return")
                    if (this.getEcho()) {
                        this.playText(item.text);

                        // Stop dequeueing elements until the current one
                        // completes - it will call printNext again.
                        return
                    }
                }
                else {
                    // Deferred. This should be the final item in the list
                    wto("printNext dequeue DEFER echo=" + this.getEcho())
                    if (this.pending.length > 0) {
                        wto("ERROR deferred item is not the last in the queue - ignored")
                    }
                    else {
                        // As this is the last item in the list we can safely
                        // indicate we are no longer printing
                        this.printing = false
                        item.deferred ()
                    }
                }
            }

            wto("printNext: finished printing set printing=false")
            this.printing = false
        }

        protected startPrinting() : void {
            wto("startPrinting pending=" + this.pending.toString() + " alreadyPrinting=" + this.printing)
            if (!this.printing) {
                wto("startPrinting calls printNext")
                this.printNext()
            }
        }

        public isPrinting() : boolean {
            return this.printing
        }

        public echo(): void {
            wto("--echo")
            this.pending.push({kind: OutputType.Echo})
            this.startPrinting()
        }

        public noecho(): void {
            wto("--noecho")
            this.pending.push({kind: OutputType.NoEcho})
            this.startPrinting()
        }

        public println(text: string){
            wto("--println " + text)
            this.print(text)
            this.crlf()
            this.startPrinting()
        }

        public print(text: string){
            wto("--print " + text)
            this.pending.push({kind: OutputType.Print, text: text})
            this.startPrinting()
        }

        public crlf() {
            wto("--crlf")
            this.pending.push({kind: OutputType.Crlf})
            this.startPrinting()
        }

        public defer(action: () => void) {
            wto("--defer")
            this.pending.push({kind: OutputType.Defer, deferred: action})
        }
        public flush() : void {
            // Empty the queue of any text we are printing
            this.pending = []
        }

        // Whether or not to actually print the character (but we will still
        // generate the keyprcess noise). This allows us to hide the entry of
        // passwords, for example
        doEcho : boolean;
        getEcho() : boolean     { return this.doEcho;}
        setEcho(value: boolean) { this.doEcho = value;}

        public playText(text: string) : void {

            const duration = text.length * 0.1;
            wto("playText '" + text + "' duration " + duration)

            if (text.length === 0) {
                wto("playText empty string")
                 setTimeout(() => {wto("playText empty string timout calling printNext"); this.printNext()})
                 return
            }
            wto("playText set printing=true")
            this.printing = true
            let printed = 0

            // If we have more than one character, play the carriage motion
            if (text.length > 1) this.sounds.playCarriage(text.length/10.0)

            for (let i = 0; i < text.length; ++i) {

                // Spaces and carriage returns have a different sound to printed
                // characters. Choose the right sound
                const sample = text.charAt(i) === ' ' ? 'space' : text.charAt(i) === '\n' ? 'crlf' : 'print';

                // Play the sound for this character. When the sound completes,
                // display the character.
                this.sounds.playSound(sample, i/10.0, false, () => {

                    let ch = text.charAt(printed);
                    wto("playSound for character='" + ch + "' code=" + text.charCodeAt(printed))
                    if (ch == '$') ch = 'l';

                    this.tty.value += ch;
                    printed++;
                    this.tty.scrollTop = this.tty.scrollHeight;

                    // If we have printed the last character in this element
                    // and there is another element, set a timer to start the
                    // next
                    if (printed == text.length) {
                        wto("playSound finished")
                        setTimeout(() => {wto("playSound timeout calling printNext"); this.printNext()})
                    }
                })
            }
        }

        public key(ch: string) {
            this.sounds.playSound('keyclick', 0, false, null)
            this.tty.value += ch;
            this.tty.scrollTop = this.tty.scrollHeight;
        }
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
            this.echoRadio.checked = this.printer.getEcho();
            this.debug = this.debugToggle.checked
        }

        private reset() : void {
            this.lineBuffer = ""
            this.busy = true
            this.printer.echo()
            this.printer.clear()
            this.printer.flush()
            this.updateUI()
            this.debug = false
        }

        private processHandlerResult(result : HandlerResult) : void {

            this.busy = result.busy
            this.updateUI()
        }

        private generateEvent(event: Event) : void {

            // If the printer is currently printing, we should wait until
            // it finishes so add this call as a deferred action
            if (this.printer.isPrinting()) {
                wto("Terminal.generateEvent deferred next with " + event.kind)
                this.printer.defer(() => this.generateEvent(event))
            }
            else if (this.currentHandler !== undefined) {
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

            console.log("addCharacter '" + character +
                        "' code=" + character.charCodeAt(0) +
                        " isInterrupt=" + isInterrupt +
                        "busy=" + this.busy +
                        "printing=" + this.printer.isPrinting());

            if (isInterrupt) {

                if (this.busy) {
                    // Flush the output generated so far and pass the interrupt
                    // to the session to generate BREAK IN or LINE nnnn BREAK
                    // IN as appropriate
                    this.printer.flush()
                    this.generateEvent({kind: EventKind.Interrupt, interrupt: character})
                }
                else if (this.printer.isPrinting()) {

                    // Flush the output and generate a BREAK IN message
                    // ourselves
                    this.printer.flush()
                    this.printer.crlf()
                    this.printer.println("BREAK IN")
                }
                else {
                    // If there is pending input, we discard it and indicate this to
                    // the user by displaying ' /x/' on the current line where x is
                    // the interrupt character (C or Z). If we are busy, then there
                    // won't be anything to discard.
                    this.printer.flush()
                    if (this.lineBuffer !== "") {
                        this.printer.println("/" + character + "/");
                        this.lineBuffer = "";
                    }
                }
            }
            else if (!this.busy && !this.printer.isPrinting()) {

                if (character === "\b") {
                    // Erase the last character and display the back-arrow rubout
                    // character
                    if (this.lineBuffer != "") {
                        this.lineBuffer = this.lineBuffer.slice(0, -1);
                        character = '_'
                        this.printer.key(character)
                    }
                }
                else if (character == "\r") {
                    this.printer.print(character)
                    this.generateEvent({kind: EventKind.Line, text: this.lineBuffer})
                    this.lineBuffer = "";
                }
                else {
                    this.lineBuffer += character;
                    this.printer.key(character)
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

        // Optional controls
        private busyRadio : HTMLInputElement;
        private debugToggle : HTMLInputElement;
        private echoRadio : HTMLInputElement;
        private clearButton : HTMLButtonElement;
        private resetButton : HTMLButtonElement;

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

        public print(text: string) {
            this.printer.print(text)
        }

        public println(text: string) {
            this.printer.println(text)
        }

        public crlf() {
            this.printer.crlf()
        }

        public echo() {
            this.printer.setEcho(true)
        }

        public noecho() {
            this.printer.setEcho(false)
        }
    }
}

