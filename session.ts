/// <reference path="terminal.ts" />
/// <reference path="filestore.ts" />
/// <reference path="utility.ts" />
/// <reference path="program.ts" />
/// <reference path="context.ts" />

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
        tty.echo();
        for (;;) {
            const ctrla : Terminal.Event = yield ({state: Terminal.State.Asleep})
            if (ctrla.kind == Terminal.EventKind.Interrupt && ctrla.interrupt == 'A') {
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
        for (;;) {
            const event = yield({state: Terminal.State.Waiting})

            if (event.kind == Terminal.EventKind.Line) {

                // HELP                                    help not yet available
                // LOGIN user(.subid)?,password            validate login
                // LOGIN user(.subid)?                     prompt for password
                //
                // The user name can be up to six characters.
                if (event.text.startsWith("HELP")) {
                    session.println("HELP NOT YET AVAILABLE")
                }
                else {
                    // Parse the command with a regex
                    const re = new RegExp(/(HELLO|LOGIN|HEL)\s+([A-Z0-9]+)?(\.([A-Z0-9]+))?\s*(,\s*(\w+))?/)
                    const match = re.exec(event.text)
                    if (match === null) {
                        session.println("PLEASE LOG IN")
                    }
                    else {
                        let [whole, command, user, group_subid, subid, group_password, password] = re.exec(event.text)
                        if (user === undefined) {
                            session.println("USER NAME MISSING")
                        }
                        else if (user.length > 6) {
                            session.println("USER NAME TOO LONG")
                        }
                        else {
                            while (password === undefined) {
                                // On a real tty, we would do a cr to move to
                                // the @s at the start of the line but we turn
                                // off echoing instead
                                session.print("@@@@ PASSWORD?")
                                session.noecho()
                                const passwordLine = yield({state: Terminal.State.Waiting})
                                session.echo()
                                if (passwordLine.kind === Terminal.EventKind.Line) {
                                    password = passwordLine.text

                                    // Because we disabled echo instead of
                                    // letting the user type over the @s,
                                    // we stopped the effect of their crlf
                                    // so imitate that now
                                    session.crlf()
                                }
                            }
                            if (!session.login(user, password)){
                                session.println("ILLEGAL ACCESS")
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

        // The user is logged so display the banner and note the starting
        // time for later use
        session.start(tty);

        let ticks = 0
        let totalTicks = 0
        let totalMs = 0
        let carryOn = true
        let startTime = new Date().getTime()
        while (carryOn) {

            switch (session.program.state) {

                case ProgramState.Running: {
                    // If the program is running but not awaiting user input, the
                    // user should be unable to type and all we expect from them
                    // is an interrupt
                    ticks += 1
                    let event : Terminal.Event = {kind: Terminal.EventKind.None}
                    if (ticks == 10000) {
                        //const endTime = new Date().getTime()
                        //const dt = endTime-startTime
                        //totalMs += dt
                        //totalTicks += ticks
                        //wto("rate: dt=" + dt + " " + totalTicks + " in " + totalMs + "ms = " + (1000*totalTicks/totalMs))
                        ticks = 0
                        //startTime=endTime
                        event = yield({state: Terminal.State.Running})
                    }
                    switch (event.kind) {

                        case Terminal.EventKind.Interrupt:
                            session.program.breakIn(session.commandContext)
                            break
                        case Terminal.EventKind.None:
                            session.program.step(session.commandContext, null)
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
                    const event : Terminal.Event = yield({state: Terminal.State.Waiting})
                    switch (event.kind) {

                        case Terminal.EventKind.Interrupt:
                            session.program.breakIn(session.commandContext)
                            break
                        case Terminal.EventKind.Line:
                            session.program.step(session.commandContext, event.text)
                            break
                        default:
                            break
                    }
                }
                break

                default: {

                    // If the program is stopped or interrupted, the user can
                    // provide input for us to process
                    const event : Terminal.Event = yield({state: Terminal.State.Waiting})
                    if (event.kind == Terminal.EventKind.Line) {
                        carryOn = session.perform(event.text)
                    }
                    else if (event.kind == Terminal.EventKind.Interrupt) {
                        // Interrupting while nothing is running is harmless
                        if (!tty.printer.isPrinting) {
                            tty.crlf();
                            tty.println("BREAK IN");
                        }
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

        constructor(private terminal : Terminal.Terminal, public readonly fileStore: FileStore) {
            this.program_ = new Program(this)
            this.commandContext = new Context(null, this.program_)
        };

        public println(line: string) : void { this.terminal.println(line) }
        public print(line: string) : void { this.terminal.print(line) }
        public crlf() : void { this.terminal.crlf() }
        public echo() : void { this.terminal.echo() }
        public noecho() : void { this.terminal.noecho() }

        public commandContext: Context

        public get program() { return this.program_ }

        // When did the user log into this session?
        private startTime : Date

        // The currently loaded program
        private program_: Program

        // The error string used by the ? command
        private lastError = ErrorCode.NoError

        public handleAsleep() {
            // Establish our event handler
            this.terminal.setHandler(asleepGenerator(this, this.terminal))
        }

        public login(username: string, password: string) : boolean {
            return this.fileStore.loginUser(username, password)
        }

        public elapsed() : number {
            // The number of minutes (rounded up) the user has been logged in
            const milliseconds = (new Date).getTime() - this.startTime.getTime()
            const msPerMin = 60*1000
            return Math.ceil(milliseconds / msPerMin);
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

        public run(line: number) {
            this.program_.run(line, this.commandContext, true)
        }

        /**
         * Check that there is a current program and that it can be
         * resumed (it hasn't been edited since it was last run, for example)
         * and then resume it from the requested line. A value of zero for
         * the line number means the next statement that would have been
         * executed.
         *
         * @param line  line number of the next line to be executed
         */
        public resume(line: number) {
            this.program_.run(line, this.commandContext, false)
        }

        public perform(command: string) : boolean {

            // There is no program running or waiting for input (but one
            // may be interrupted). Process this command.

            // Ignore blank lines:
            if (command === "") return true

            // Try to parse the line. We end up with a successful parse,
            // an error code or null indicating no content
            const parser = new BasicParser
            const node = parser.parse(command)
            if (node instanceof Command) {

                // ? is a special case because the session has the
                // last error
                if (node instanceof QuestionCmd) {
                    this.terminal.println(ErrorCode.textOf(this.lastError))
                    return true
                }
                else {
                    // Commands require no context
                    const terminated = node instanceof ByeCmd;
                    node.execute(this);
                    return !terminated
                }
            }
            else if (node instanceof Statement) {

                const statement : Statement = node;

                // Immediate statements may raise exceptions. Execute
                // them in our interactive context. If they produce
                // output but don't end the line (eg 'PRINT 3;') we
                // clean up ourselves
                try {
                    statement.execute(this.commandContext)
                    this.commandContext.owner.channels.closeChannels()
                }
                catch (e) {
                    if (e instanceof Utility.RunTimeError) {
                        this.commandContext.owner.channels.closeChannels()
                        this.lastError = e.error
                        this.println(this.lastError)
                    }
                    else{
                        throw e
                    }
                }
            }
            else if (typeof(node) == "string") {

                // We didn't parse it. Record the error for the '?'
                // command
                this.terminal.println(node);
                this.lastError = node;
            }
            else {
                Utility.bugcheck("unexpected value returned by parser")
            }

            // Indicate that we should carry on with this session
            return true
        }


        // We don't yet know how to do this:
        public mill() : number {
            return Math.floor(this.elapsed() / 1000);
        }
    }
}