/// <reference path="terminal.ts" />

namespace Session {
    export class Session {

        constructor(private terminal : Terminal.Terminal) {};

        private async triple(count: number)
        {
            for (let x = 1;; x++) {
                for (let y = 1; y < x; y++) {
                    for (let z = 1; z <= y; z++) {
                        if (x*x === y*y + z*z) {
                            count--
                            if (count == 0) {
                                wto("*******")
                                this.terminal.printer.print("READY? ")
                                const reply = await this.terminal.poll(false)
                                this.terminal.printer.println("GOT " + reply)
                                return [x, y, z]
                            }
                        }
                        const event = await this.terminal.poll(true)
                    }
                }
            }
        }

        async perform() {

            // This is a stub session so all we do is repeatedly poll the 
            // terminal and display the response we receive until we are
            // asked to stop
            let count = 0

            for (;;) {
                // Wait for a line which will be 'triple' to generate the
                // next triple or 'hello' to ping the server
                const result = await this.terminal.poll(false);
                if (result.kind === Terminal.EventKind.Line) {
                    wto("perform received line " + result.text)
                    if (result.text === "TRIPLE") {
                        wto("session perform calling triple");
                        count += 1
                        const [x, y, z] = await this.triple(count)
                        this.terminal.printer.println("TRIPLE " + x + " " + y + " " + z)
                    }
                    else {
                        this.terminal.printer.println("IGNORED")
                      }
                }
                wto(result.toString());
            }
        }
    }
}