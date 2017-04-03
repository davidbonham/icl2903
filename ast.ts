/// <reference path="session.ts" />
/// <reference path="terminal.ts" />

class ASTNode {

}

class Statement extends ASTNode {

}

class Command extends ASTNode {
    public execute(session: Session.Session, tty: Terminal.Terminal) : void {}
}

class QuestionCmd extends Command {

    public  execute(session: Session.Session, tty: Terminal.Terminal) : void {}
}

// BYE - log out from BASIC system
//
// Update the account information in the users filespace with the values
// for this session.
//
// The Session object will also spot the BYE command and terminate this
// instance.

class ByeCmd extends Command
{
    public  execute(session: Session.Session, tty: Terminal.Terminal) : void
    {
        // Update the user's account for this session
        const elapsedMinutes = session.elapsed();
        /*
        var account = new Account(session.filespace);
        account.update(1, elapsedMinutes, session.mill(), false);
        account.save();
        */

        // Render with leading zeros
        const time = ("0000" + elapsedMinutes).slice(-4)
        // Tell the user they've logged out
        tty.println(time + " MINS. TERM. TIME.")
    }
}
