"use strict";
var Terminal;
(function (Terminal_1) {
    class Keyboard {
        constructor(terminal, tty) {
            this.terminal = terminal;
            this.tty = tty;
            // Set up the callbacks for the interesting keyboard events. When these
            // events identify a character or interrupt, they will pass it to the
            // terminal
            this.tty.onkeypress = (event) => {
                console.log('onkeypress ' + event);
                if (!event.ctrlKey) {
                    this.processKeyEvent(event, false, String.fromCharCode(event.which)); // All others
                }
                event.preventDefault();
                event.stopPropagation();
                event.returnValue = false;
                return false;
            };
            this.tty.onkeydown = (event) => {
                console.log('onkeydown ' + event);
                let block = false;
                if (event.ctrlKey) {
                    // Ignore the control key down event itself and just process any
                    // characters typed while it is down.
                    if (event.which != 17) {
                        this.processKeyEvent(event, true, String.fromCharCode(event.which));
                        block = true;
                    }
                }
                else if (event.which == 13) {
                    // Return key
                    this.processKeyEvent(event, false, String.fromCharCode(event.which));
                    block = true;
                }
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
            };
        }
        processKeyEvent(key_event, is_ctrl, ch) {
            ch = ch.toUpperCase();
            if (is_ctrl) {
                // Control characters that interrupt. Ignore the others
                if (ch == "A" || ch == "C" || ch == "X") {
                    this.terminal.addCharacter(ch, true);
                }
            }
            else if ("\b\r ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"$%^&*()-+=[];:@'#<>,.?/".indexOf(ch) != -1) {
                // A character to be found on the teletype keyboard
                this.terminal.addCharacter(ch, false);
            }
            return false;
        }
    }
    class Printer {
        constructor(tty) {
            this.tty = tty;
            this.doEcho = false;
        }
        clear() {
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
        print(text) {
            // This is a stub implementation which ignores the timing and 
            // displays the text immediately
            for (let ch of text) {
                // Convert dollars to pounds in a UK teletype font
                if (ch === '$')
                    ch = 'l';
                this.tty.value += ch;
                this.tty.scrollTop = this.tty.scrollHeight;
            }
        }
        println(text) {
            this.print(text + "\n");
        }
        get echo() { return this.doEcho; }
        set echo(value) { this.doEcho = value; }
    }
    function isHTMLTextAreaElement(element) {
        return element instanceof HTMLTextAreaElement;
    }
    class Terminal {
        /**
         * Construct a new terminal object
         *
         * @param name  the name of an HTMLTextAreaElement to be used to display
         */
        constructor(id) {
            let tty = document.getElementById(id);
            if (isHTMLTextAreaElement(tty)) {
                // Wire up the terminal components
                this.printer = new Printer(tty);
                this.keyboard = new Keyboard(this, tty);
                // Look for the optional UI elements
                this.busyRadio = document.getElementById("busy");
                this.echoRadio = document.getElementById("echo");
                this.clearButton = document.getElementById("clear");
                this.resetButton = document.getElementById("reset");
                this.busyRadio.onclick = () => { };
                this.echoRadio.onclick = () => { };
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
        updateUI() {
            this.busyRadio.checked = this.busy;
            this.echoRadio.checked = this.printer.echo;
        }
        reset() {
            this.lineBuffer = "";
            this.busy = true;
            this.printer.echo = true;
            this.printer.clear();
            this.updateUI();
        }
        addCharacter(character, isInterrupt = false) {
            console.log("addCharacter '" + character + "' isInterrupt=" + isInterrupt);
            if (isInterrupt) {
                // If there is pending input, we discard it and indicate this to
                // the user by displaying ' /x/' on the current line where x is 
                // the interrupt character (C or Z). If we are busy, then there 
                // won't be anything to discard.
                if (this.lineBuffer !== "") {
                    this.printer.println(" /" + character + "/");
                    this.lineBuffer = "";
                }
                this.pollResolution({ kind: 3 /* Interrupt */, interrupt: character });
            }
            else if (!this.busy) {
                if (character === "\b") {
                    // Erase the last character and display the back-arrow rubout
                    // character
                    if (this.lineBuffer != "") {
                        this.lineBuffer = this.lineBuffer.slice(0, -1);
                        character = '_';
                    }
                }
                else if (character == "\r") {
                    this.pollResolution({ kind: 2 /* Line */, text: this.lineBuffer });
                    this.lineBuffer = "";
                }
                else {
                    this.lineBuffer += character;
                }
                this.printer.print(character);
            }
            else {
                // We are busy so we discard any non-interrupt keys
            }
        }
        poll() {
            return new Promise((resolve) => this.pollResolution = resolve);
        }
    }
    Terminal_1.Terminal = Terminal;
})(Terminal || (Terminal = {}));
