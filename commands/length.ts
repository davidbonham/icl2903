class LengthCmd extends Command {

    public execute(session: Session.Session) : void {

        // Calculate the size in buckets, rounded up to whole buckets
        const bucketCount = Math.floor((session.program.size() + 3 * 128 - 1) / (3 * 128))

        const lines = ("0000" + session.program.lineCount()).slice(-4)
        const buckets = ("0000" + bucketCount).slice(-4)
        session.println(lines + " LINES. " + buckets + " BUCKETS.")
    }

    public static parse(scanner: Scanner) : LengthCmd{
        return new LengthCmd
    }
}
