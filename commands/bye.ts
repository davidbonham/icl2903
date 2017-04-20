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

        let account = session.fileStore.getAccount()
        account.update(1, elapsedMinutes, session.mill(), false);
        account.save();

        // Render four digits with leading zeros
        const time = Utility.padInteger(elapsedMinutes, 4, '0')

        // Tell the user they've logged out
        session.println(time + " MINS. TERM. TIME.")
    }
}
