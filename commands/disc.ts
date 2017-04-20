/**
 * The DISC command tells the user how much of their allocated disc quota
 * they have used. A bucket of disc space is 128 words and the ICL 2903
 * is a 24-bit machine so this corresponds to 128*3 = 384 bytes per bucket.
 */

class DiscCmd extends Command {

    public execute(session: Session.Session) : void {

        // Get the last saved settings from disc
        const account = session.fileStore.getAccount();

        // Update them with the values used this session. We won't save the results
        account.update(1, session.elapsed(), session.mill(), true);

        // Format the values into strings padded with leading zeros.
        const disc    = Utility.padInteger(account.disc, 4, "0")
        const maxDisc = Utility.padInteger(account.maxDisc, 4, "0")

        session.println("DISC USED = " + disc + " BUCKETS  MAX = " + maxDisc + " BUCKETS")
    }
}