/// <reference path="terminal.ts" />

namespace Session {
    export class Session {

        constructor(private terminal : Terminal.Terminal) {};

        async perform() {

            // This is a stub session so all we do is repeatedly poll the 
            // terminal and display the response we receive until we are
            // asked to stop
            for (;;) {
                const result = await this.terminal.poll();
                if (result.kind === Terminal.EventKind.Quit) break;
                console.log(result);
            }
        }
    }
}