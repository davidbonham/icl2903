/// <reference path="../ast.ts" />

// ? - Display the full text of the last error message
//
// Some error messages are reported by error number only - I imagine this
// was because the overlay in which they were contained (the command processing
// perhaps) did not have room for the full text. The ? command displays the
// full text corresponding to the error number.
//
// Because the last error is state of the session, this command is never
// executed. Instead the session spots the result of the parse and handles
// it itself.
class QuestionCmd extends Command {
    public  execute(session: Session.Session) : void {}
}

