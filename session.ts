/// <reference path="terminal.ts" />
/// <reference path="filestore.ts" />
/// <reference path="utility.ts" />
/// <reference path="program.ts" />

namespace Session {

    /**
     * Handle the system's "asleep" state
     *
     * Initially, and after a user logs out of their session, the system
     * is asleep. The ICL7502 modular terminal processor waits for the
     * next user to request attention by typeing ctrl-A. Keyboard input
     * is not reflected and is ignored until that happens.
     *
     * Whatever event is passed to us via yield, ignore it and yield once
     * more looking busy until the event is the 'A' interrupt. At that
     * point, switch to the login state and yield indicating we are ready
     * to handle keyboard input.
     *
     * @param session   the session for this browser session
     * @param tty       the terminal device attached to this session
     */
    function* asleepGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {
        wto("enter asleepGenerator - set echo false")
        tty.noecho();
        for (;;)
        {
            wto("asleepGenerator yielding to receive ctrl-a as busy")
            const ctrla : Terminal.Event = yield ({busy: true})
            wto("asleepGenerator received event " + ctrla.kind)
            if (ctrla.kind == Terminal.EventKind.Interrupt && ctrla.interrupt == 'A')
            {
                wto("asleepGenerate to loginGenerator")
                tty.setPendingHandler(loginGenerator (session, tty))
                return {busy: false};
            }
        }
    }

    /**
     * Handle the login state
     *
     * The user has attracted our attention. Read lines of input from the
     * terminal until the user has specified a login or hello command with
     * the correct syntax and a username and password that exist. It appears
     * that there was an intention to provide help for the login process
     * but there is no documentation to suggest what it might have looked
     * like. The real system simply announces it wasn't available yet.
     *
     * There is no intention to provide secure access - all communication
     * is performed over a clear HTTP connection in any case. All we want
     * to do is present to the user how a real system would have behaved.
     *
     * The username and password information is held in the session storage
     * managed by the file store. We would have started loading it when
     * the file store was created and expect that it will have been created
     * by now. If not, the user will be unlucky and unable to log in.
     *
     * Once the user has logged in correctly we switch to the session
     * state ready to handle the user until they log out.
     *
     * TODO: Handle subids for users
     *
     * @param session   the session for this browser session
     * @param tty       the terminal device attached to this session
     */
    function* loginGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {

        // The user had attracted our attention. Enable the keyboard to allow
        // them to type the login command. We no longer appear busy.
        tty.echo()
        for (;;)
        {
            wto("loginGenerator yielding idle for command line")
            const event = yield({busy: false})

            if (event.kind == Terminal.EventKind.Line) {
                wto("loginGenerator received event '" + event.text + "'")

                // HELP                                    help not yet available
                // LOGIN user(.subid)?,password            validate login
                // LOGIN user(.subid)?                     prompt for password
                //
                // The user name can be up to six characters.
                if (event.text.startsWith("HELP")) {
                    tty.println("HELP NOT YET AVAILABLE")
                }
                else {
                    // Parse the command with a regex
                    const re = new RegExp(/(HELLO|LOGIN|HEL)\s+([A-Z0-9]+)?(\.([A-Z0-9]+))?\s*(,\s*(\w+))?/)
                    const match = re.exec(event.text)
                    if (match === null) {
                        tty.println("PLEASE LOG IN")
                    }
                    else {
                        let [whole, command, user, group_subid, subid, group_password, password] = re.exec(event.text)
                        if (user === undefined) {
                            tty.println("USER NAME MISSING")
                        }
                        else if (user.length > 6) {
                            tty.println("USER NAME TOO LONG")
                        }
                        else {
                            while (password === undefined) {
                                // On a real tty, we would do a cr to move to
                                // the @s at the start of the line but we turn
                                // off echoing instead
                                tty.print("@@@@ PASSWORD?")
                                tty.noecho()
                                const passwordLine = yield({busy: false})
                                tty.echo()
                                if (passwordLine.kind === Terminal.EventKind.Line) {
                                    password = passwordLine.text
                                    wto("password='" + password + "'" )

                                    // Because we disabled echo instead of
                                    // letting the user type over the @s,
                                    // we stopped the effect of their crlf
                                    // so imitate that now
                                    tty.println("")
                                }
                            }
                            if (!session.login(user, password)){
                                tty.println("ILLEGAL ACCESS")
                            }
                            else {
                                tty.setPendingHandler(sessionGenerator(session, tty))
                                return {busy: false}
                            }
                        }
                    }
                }
            }
        }
    }

    function* sessionGenerator (session: Session, tty: Terminal.Terminal) : IterableIterator<Terminal.HandlerResult> {

        wto("sessionGenerator")

        // The user is logged so display the banner and note the starting
        // time for later use
        session.start(tty);

        let carryOn = true
        while (carryOn) {

            switch (session.program.state) {

                case ProgramState.Running: {
                    // If the program is running but not awaiting user input, the
                    // user should be unable to type and all we expect from them
                    // is an interrupt
                    const event : Terminal.Event = yield({busy:true})
                    switch (event.kind) {

                        case Terminal.EventKind.Interrupt:
                            session.program.breakIn()
                            break
                        case Terminal.EventKind.None:
                            session.program.step()
                            break
                        default:
                            throw "unexpect event type " + event.kind + " while running"
                    }
                }
                break

                case ProgramState.Input: {
                    // If the program is running but waiting for input, the
                    // user can interrupt or supply a line of input. We are
                    // not busy, the user can type.
                    const event : Terminal.Event = yield({busy:false})
                    switch (event.kind) {

                        case Terminal.EventKind.Interrupt:
                            session.program.breakIn()
                            break
                        case Terminal.EventKind.Line:
                            session.program.stepInput(event.text)
                            break
                        default:
                            break
                    }
                }
                break

                default: {

                    // If the program is stopped or interrupted, the user can
                    // provide input for us to process
                    const event : Terminal.Event = yield({busy:false})
                    if (event.kind == Terminal.EventKind.Line) {
                        carryOn = session.perform(event.text)
                    }
                    else if (event.kind == Terminal.EventKind.Interrupt) {
                        // Interrupting while nothing is running is harmless
                        tty.println("");
                        tty.println("BREAK IN IGNORED");
                    }
                }
            }
        }

        // The user has logged out of the session. Return outselves to the
        // asleep state
        tty.setPendingHandler(asleepGenerator(session, tty))
        return {busy: false}
    }

    export class Session {

        constructor(private terminal : Terminal.Terminal, private fileStore: FileStore) {
            this.program_ = new Program
        };

        public get program() { return this.program_ }

        // When did the user log into this session?
        private startTime : Date

        // The currently loaded program
        private program_: Program

        public handleAsleep() {
            // Establish our event handler
            wto("handleAsleep establishing asleepGenerator")
            this.terminal.setHandler(asleepGenerator(this, this.terminal))
        }

        public login(username: string, password: string) : boolean {
            return this.fileStore.loginUser(username, password)
        }

        public start(tty: Terminal.Terminal) : void {
            this.startTime = new Date()
            const date = Utility.basicDate(this.startTime)
            const time = Utility.basicTime(this.startTime)

            tty.println("NSP 2903 BASIC SYSTEM")
            tty.println(date + " TIME " + time)
            tty.println("READY")
            tty.println("")
        }

        public perform(command: string) : boolean {

            // There is no program running or waiting for input (but one
            // may be interrupted). Process this command.

            // Ignore blank lines:
            if (command === "") return true

            // Indicate that we should carry on with this session
            wto("session process " + command)
            return command !== "BYE"
        }
    }
}