class DateCmd extends Command {

    public execute(session: Session.Session) : void {
        const now = new Date
        const date = Utility.basicDate(now)
        const time = Utility.basicTime(now)
        session.println(" " + date + " TIME " + time)
    }

    public static parse(scanner: Scanner) : DateCmd {
        return new DateCmd
    }
}
