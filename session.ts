/// <reference path="terminal.ts" />
/// <reference path="filestore.ts" />
/// <reference path="utility.ts" />

namespace Session {

    function* asleepGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<boolean> {
        wto("enter asleepGenerator - set echo false")
        tty.echo(false);
        for (;;)
        {
            wto("asleepGenerator yielding to receive ctrl-a as busy")
            const ctrla : Terminal.Event = yield (true)
            wto("asleepGenerator received event " + ctrla.kind)
            if (ctrla.kind == Terminal.EventKind.Interrupt && ctrla.interrupt == 'A')
            {
                wto("asleepGenerate to loginGenerator")
                tty.setPendingHandler(loginGenerator (session, tty))
                return false;
            }
        }
    }

    function* loginGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<boolean> {

        // The user had attracted our attention. Enable the keyboard to allow
        // them to type the login command. We no longer appear busy.
        tty.echo(true)
        for (;;)
        {
            wto("loginGenerator yielding idle for command line")
            const event = yield(false)
            if (event.kind == Terminal.EventKind.Line) {
                wto("loginGenerator received event '" + event.text + "'")

                // HELP                                    help not yet available
                // LOGIN user(.subid)?,password            validate login
                // LOGIN user(.subid)?                     prompt for password
                //
                // The user name can be up to six characters.
                if (event.text.startsWith("HELP")) {
                    tty.printer.println("HELP NOT YET AVAILABLE")
                }
                else {
                    // Parse the command with a regex
                    const re = new RegExp(/(HELLO|LOGIN|HEL)\s+([A-Z0-9]+)?(\.([A-Z0-9]+))?\s*(,\s*(\w+))?/)
                    const match = re.exec(event.text)
                    if (match === null) {
                            tty.printer.println("PLEASE LOG IN")
                    }
                    else {
                        let [whole, command, user, group_subid, subid, group_password, password] = re.exec(event.text)
                        if (user === undefined) {
                            tty.printer.println("USER NAME MISSING")
                        }
                        else if (user.length > 6) {
                            tty.printer.println("USER NAME TOO LONG")
                        }
                        else {
                            while (password === undefined) {
                                // On a real tty, we would do a cr to move to
                                // the @s at the start of the line but we turn
                                // off echoing instead
                                tty.printer.print("@@@@ PASSWORD?")
                                tty.echo(false)
                                const passwordLine = yield(false) 
                                tty.echo(true)
                                if (passwordLine.kind === Terminal.EventKind.Line) {
                                    password = passwordLine.text
                                    wto("password='" + password + "'" )
                                }
                            }
                            if (!session.login(user, password)){
                                tty.printer.println("ILLEGAL ACCESS")
                            }
                            else {
                                tty.setPendingHandler(sessionGenerator(session, tty))
                                return false
                            }
                        }
                    }
                }
            }
        }
    }

    function* sessionGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<boolean> {

        // The user is logged so display the banner and note the starting
        // time for later use
        session.start();

        wto("sessionGenerator")
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

        public start() : void {
            this.startTime = new Date()
            const date = Utility.basicDate(this.startTime)
            const time = Utility.basicTime(this.startTime)
            
            this.terminal.printer.println("NSP 2903 BASIC SYSTEM")
            this.terminal.printer.println(date + " TIME " + time)
            this.terminal.printer.println("READY")
            this.terminal.printer.println("")
        }
    }
}