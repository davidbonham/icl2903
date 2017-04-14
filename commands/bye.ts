/// <reference path="../ast.ts" />

// BYE - log out from BASIC system
//
// Update the account information in the users filespace with the values
// for this session.
//
// The Session object will also spot the BYE command and terminate this
// instance.

class ByeCmd extends Command {
    public  execute(session: Session.Session) : void {

        // Update the user's account for this session
        const elapsedMinutes = session.elapsed();
        /*
        var account = new Account(session.filespace);
        account.update(1, elapsedMinutes, session.mill(), false);
        account.save();
        */

        // Render four digits with leading zeros
        const time = ("0000" + elapsedMinutes).slice(-4)

        // Tell the user they've logged out
        session.println(time + " MINS. TERM. TIME.")
    }
}
