/**
 * TIME
 *
 * Display the number of minutes this session has lasted, the total number
 * of minutes logged on and the quota.
 *
 * The odd formatting of the output reflects the real system'a behavior,
 * so don't be tempted to fix it.
 */
class TimeCmd extends Command {

    public static parse(scanner: Scanner) : TimeCmd {
        return new TimeCmd()
    }

    public execute(session: Session.Session) : void  {
        const minutes = session.elapsed()

        // Get the last saved settings from disc
        let account = session.fileStore.getAccount()
        const time = Utility.padInteger(minutes, 4, '0')
        const total = Utility.padInteger(account.time + minutes, 5, '0')
        const max = Utility.padInteger(account.maxTime, 5, '0')

        session.println("TERM TIME = "+time+" MINS TOTAL="+total+" MAX ="+max)
        session.crlf()
    }
}
