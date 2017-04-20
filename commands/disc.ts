class DiscCmd extends Command {

    public execute(session: Session.Session) : void {

        // Get the last saved settings from disc
        const account = session.fileStore.getAccount();

        // Update them with the values used this session. We won't save the results
        account.update(1, session.elapsed(), session.mill(), true);

        const disc    = Utility.padInteger(account.disc, 4, "0")
        const maxDisc = Utility.padInteger(account.maxDisc, 4, "0")
        session.println("DISC USED = " + disc + " BUCKETS  MAX = " + maxDisc + " BUCKETS")
        console.log(new Error().stack)
    }
}