/**
 * LENGTH
 *
 * Display the size of the curent program or terminal format data file in
 * lines and buckets. (A bucket is 128 24-bit words.)
 */
class LengthCmd extends Command {

    public execute(session: Session.Session) : void {

        // Calculate the size in buckets, rounded up to whole buckets
        const bucketCount = Utility.buckets(session.program.size())

        const lines = Utility.padInteger(session.program.lineCount(), 4, '0')
        const buckets = Utility.padInteger(bucketCount, 4, '0')
        session.println(lines + " LINES. " + buckets + " BUCKETS.")
    }

    public static parse(scanner: Scanner) : LengthCmd{
        return new LengthCmd
    }
}
