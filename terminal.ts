
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
    export enum State {Asleep, Waiting, Running}
    export type HandlerResult = {state: State; output?: Output[]}

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
        }

        public clear() : void {
            this.tty.value = "";
            this.tty.scrollTop = this.tty.scrollHeight;
        }

        public dumpQueue() : void {
            wto("printer: printing=" + this.printing + " echo=" + this.getEcho() + " queue length:" + this.pending.length)
            for (const o of this.pending) {
                switch (o.kind) {
                    case OutputType.Echo:   wto("    ECHO");                    break
                    case OutputType.NoEcho: wto("    NOECHO");                  break
                    case OutputType.Crlf:   wto("    CRLF");                    break
                    case OutputType.Defer:  wto("    DEFER");                   break
                    case OutputType.Print:  wto("    PRINT '" + o.text + "'");  break
                }
            }
        }

        protected printNext() : void {

            // If there are still elements in the queue we are printing
            // and we can dispatch the next item
            if (this.pending.length > 0) {

                this.printing = true
                const item: Output = this.pending.shift()
                if (item.kind === OutputType.Echo) {
                    this.setEcho(true)
                    setTimeout(() => {this.printNext()})
                }
                else if (item.kind === OutputType.NoEcho) {
                    this.setEcho(false)
                    setTimeout(() => {this.printNext()})
                }
                else if (item.kind === OutputType.Crlf) {
                    if (this.getEcho()) {
                        this.playText("\n")
                    }
                    else {
                        setTimeout(() => {this.printNext()})
                    }
                }
                else if (item.kind == OutputType.Print) {
                    if (this.getEcho()) {
                        this.playText(item.text);
                    }
                    else {
                        setTimeout(() => {this.printNext()})
                    }
                }
                else {
                    // Deferred. This should be the final item in the list
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
            else {
                this.printing = false
            }
        }

        public startPrinting() : void {
            if (!this.printing) {
                this.printNext()
            }
        }

        public isPrinting() : boolean {
            return this.printing
        }

        public echo(): void {
            this.pending.push({kind: OutputType.Echo})
        }

        public noecho(): void {
            this.pending.push({kind: OutputType.NoEcho})
        }

        public println(text: string){
            this.print(text)
            this.crlf()
        }

        public print(text: string){
            this.pending.push({kind: OutputType.Print, text: text})
        }

        public crlf() {
            this.pending.push({kind: OutputType.Crlf})
        }

        public defer(action: () => void) {
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

            if (text.length === 0) {
                 setTimeout(() => {this.printNext()})
                 return
            }
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
                    if (ch == '$') ch = 'l';

                    this.tty.value += ch;
                    printed++;
                    this.tty.scrollTop = this.tty.scrollHeight;

                    // If we have printed the last character in this element
                    // and there is another element, set a timer to start the
                    // next
                    if (printed == text.length) {
                        setTimeout(() => {this.printNext()})
                    }
                })
            }
        }

        public key(ch: string) {
            this.sounds.playSound('keyclick', 0, false, null)
            if (this.getEcho()) {
                this.tty.value += ch;
                this.tty.scrollTop = this.tty.scrollHeight;
            }
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
                this.updateUI();
            }
            else {
                throw "DOM element with id " + id + " is not an HTMLTextAreaElement";
            }
        }

        private updateUI() : void {
            this.busyRadio.checked = this.state != State.Waiting;
            this.echoRadio.checked = this.printer.getEcho();
            this.debug = this.debugToggle.checked
        }

        private reset() : void {
            this.lineBuffer = ""
            this.state = State.Asleep
            this.tickSession = false
            this.printer.echo()
            this.printer.clear()
            this.printer.flush()
            this.updateUI()
            this.debug = false
        }

        private processHandlerResult(result : HandlerResult) : void {

            this.state = result.state
            this.updateUI()

            // If the session is busy, the only events it expects are
            // interrupts and None events that tick the program. Set up
            // a time to generate the tick
            if (this.state == State.Running) setTimeout(()=>this.generateEvent({kind: EventKind.None}), 1000)
        }

        private generateEvent(event: Event) : void {

            if (this.printer.isPrinting()) {
                // The printer is currently printing, we should wait until
                // it finishes so add this call as a deferred action
                wto("Terminal.generateEvent deferred next with " + event.kind)
                this.printer.defer(() => this.generateEvent(event))
            }
            else if (this.currentHandler !== undefined) {

                // Nothing is printing. Tick the current handler now
                wto("Terminal.generateEvent nothing printing so call next with " + event.kind)
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

                // The handler may have generated some output so start printing
                // anything that may be queued
                wto("Terminal.generateEvent finished next so start printing anything generated")
                this.printer.dumpQueue()
                this.printer.startPrinting()
            }
        }

        public addCharacter(character: string, isInterrupt: boolean = false) {

            //console.log("addCharacter '" + character +
            //            "' code=" + character.charCodeAt(0) +
            //            " isInterrupt=" + isInterrupt +
            //            " state=" + State[this.state] +
            //            " printing=" + this.printer.isPrinting());

            if (isInterrupt) {

                if (this.state != State.Waiting) {
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
            else if (this.state == State.Waiting && !this.printer.isPrinting()) {

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
        private state : State;
        public debug : boolean;
        private tickSession : boolean

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
            wto("Terminal.setHandler received state=" + State[this.state])
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
            this.printer.echo()
        }

        public noecho() {
            this.printer.noecho()
        }
    }


}

