
class AccountCmd extends Command
{
    public execute(session: Session.Session) : void {

        // Get the last saved settings from disc
        const account = session.fileStore.getAccount();

        // Update them with the values used this session. We won't save the results
        account.update(1, session.elapsed(), session.mill(), true);

        // Get the results and display them
        const logins    = Utility.padInteger(account.logins, 5, "0")
        const maxLogins = Utility.padInteger(account.maxLogins, 5, "0")
        const time      = Utility.padInteger(account.time, 5, "0")
        const maxTime   = Utility.padInteger(account.maxTime, 5, "0")
        const mill      = Utility.padInteger(account.mill, 5, "0")
        const maxMill   = Utility.padInteger(account.maxMill, 5, "0")
        const disc      = Utility.padInteger(account.disc, 4, "0")
        const maxDisc   = Utility.padInteger(account.maxDisc, 4, "0")

        session.println("NO LOGINS = " + logins + "  MAX = " + maxLogins)
        session.crlf()
        session.println("TOT TIME USED = " + time + " MIN MAX = " + maxTime + " MIN")
        session.crlf()
        session.println("TOT MILL TIME = " + mill + " MIN MAX = " + maxMill  + " MIN")
        session.crlf()
        session.println("DISC USED = " + disc + " BUCKETS  MAX = " + maxDisc + " BUCKETS")
        session.crlf()
    }
}
