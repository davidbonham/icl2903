/// <reference path="terminal.ts" />
/// <reference path="filestore.ts" />
/// <reference path="utility.ts" />

namespace Session {

    function* asleepGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {
        wto("enter asleepGenerator - set echo false")
        let op = new OutputAccumulator;
        op.noecho();
        for (;;)
        {
            wto("asleepGenerator yielding to receive ctrl-a as busy")
            const ctrla : Terminal.Event = yield ({busy: true, output: op.finish()})
            wto("asleepGenerator received event " + ctrla.kind)
            if (ctrla.kind == Terminal.EventKind.Interrupt && ctrla.interrupt == 'A')
            {
                wto("asleepGenerate to loginGenerator")
                tty.setPendingHandler(loginGenerator (session, tty))
                return {busy: false};
            }
        }
    }

    function* loginGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {

        let op = new OutputAccumulator;

        // The user had attracted our attention. Enable the keyboard to allow
        // them to type the login command. We no longer appear busy.
        op.echo()
        for (;;)
        {
            wto("loginGenerator yielding idle for command line")
            const event = yield({busy: false, output:op.finish()})

            if (event.kind == Terminal.EventKind.Line) {
                wto("loginGenerator received event '" + event.text + "'")

                // HELP                                    help not yet available
                // LOGIN user(.subid)?,password            validate login
                // LOGIN user(.subid)?                     prompt for password
                //
                // The user name can be up to six characters.
                if (event.text.startsWith("HELP")) {
                    op.println("HELP NOT YET AVAILABLE")
                }
                else {
                    // Parse the command with a regex
                    const re = new RegExp(/(HELLO|LOGIN|HEL)\s+([A-Z0-9]+)?(\.([A-Z0-9]+))?\s*(,\s*(\w+))?/)
                    const match = re.exec(event.text)
                    if (match === null) {
                        op.println("PLEASE LOG IN")
                    }
                    else {
                        let [whole, command, user, group_subid, subid, group_password, password] = re.exec(event.text)
                        if (user === undefined) {
                            op.println("USER NAME MISSING")
                        }
                        else if (user.length > 6) {
                            op.println("USER NAME TOO LONG")
                        }
                        else {
                            while (password === undefined) {
                                // On a real tty, we would do a cr to move to
                                // the @s at the start of the line but we turn
                                // off echoing instead
                                op.print("@@@@ PASSWORD?")
                                op.noecho()
                                const passwordLine = yield({busy: false, output: op.finish()})
                                op.echo()
                                if (passwordLine.kind === Terminal.EventKind.Line) {
                                    password = passwordLine.text
                                    wto("password='" + password + "'" )

                                    // Because we disabled echo instead of 
                                    // letting the user type over the @s, 
                                    // we stopped the effect of their crlf
                                    // so imitate that now
                                    op.println("")
                                }
                            }
                            if (!session.login(user, password)){
                                op.println("ILLEGAL ACCESS")
                            }
                            else {
                                tty.setPendingHandler(sessionGenerator(session, tty))
                                return {busy: false, output: op.finish()}
                            }
                        }
                    }
                }
            }
        }
    }

    function* sessionGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {

        wto("sessionGenerator")

        let op = new OutputAccumulator
        // The user is logged so display the banner and note the starting
        // time for later use
        session.start(op);
        return {busy: false, output: op.finish()}
    }

    class OutputAccumulator {

        constructor(private pendingOutput: Terminal.Output[] = []) {}

        echo(): void { 
            this.pendingOutput.push({kind: Terminal.OutputType.Echo})
        }

        noecho(): void { 
            this.pendingOutput.push({kind: Terminal.OutputType.NoEcho})
        }

        println(text: string)
        {
            this.pendingOutput.push({kind: Terminal.OutputType.PrintLn, text: text})
        }

        print(text: string)
        {
            this.pendingOutput.push({kind: Terminal.OutputType.Print, text: text})
        }

        finish () : Terminal.Output[] {
            const current = this.pendingOutput
            this.pendingOutput = []
            return current
        }
    }

    export class Session {

        constructor(private terminal : Terminal.Terminal, private fileStore: FileStore) {};

        private startTime : Date
        public handleAsleep() {

            // Establish our event handler
            wto("handleAsleep establishing asleepGenerator")
            this.terminal.setHandler(asleepGenerator(this, this.terminal))
        }

        public login(username: string, password: string) : boolean {
            return this.fileStore.loginUser(username, password)
        }

        public start(op: OutputAccumulator) : void {
            this.startTime = new Date()
            const date = Utility.basicDate(this.startTime)
            const time = Utility.basicTime(this.startTime)
            
            op.println("NSP 2903 BASIC SYSTEM")
            op.println(date + " TIME " + time)
            op.println("READY")
            op.println("")
        }
    }
}