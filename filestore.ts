class FileStore
{
    username : string = "";
    password : string = "";

    busyButton = <HTMLInputElement>document.getElementById("fs_busy")
    onlineButton = <HTMLInputElement>document.getElementById("fs_online")
    transactionLog = <HTMLTextAreaElement>document.getElementById("fs_log")
    activeTransactions = 0;
    recentlyOnline = false

    log(message: string) {
        this.transactionLog.value += message + "\n"
        this.transactionLog.scrollTop = this.transactionLog.scrollHeight;

    }

    updateUI()
    {
        this.busyButton.checked = this.activeTransactions > 0;
        this.onlineButton.checked = this.recentlyOnline;
    }

    protected infoKey(isLibrary: boolean, filename: string) : string {
        const name = isLibrary ? "LIBRY" : this.username
        return "FILE_INFO_" + name + "_" + filename
    }

    protected dataKey(isLibrary: boolean, filename: string) : string {
        const name = isLibrary ? "LIBRY" : this.username
        return "FILE_DATA_" + name + "_" + filename
    }

    public initialise() {

        // Clear the file store log
        this.transactionLog.value = ""

        // Discard any previous accounting info and make sure the dictionary
        // exists in case we're too slow loading the real data before a login
        // attempt
        let accounts : { [name: string] : string} = {}
        sessionStorage.accounts = accounts

        // Set of a timer to check the state of the remove file server every
        // ten seconds
        this.log("INITIALISE")
        setInterval(() => {
            this.perform("HELLO", (request: XMLHttpRequest|undefined) => {
                this.recentlyOnline = request !== undefined && request.status == 200
                this.updateUI();
            })}, 10000000)

        // Get user accounting info and update the object we created above
        this.perform("LOAD _ACCOUNTS", (request: XMLHttpRequest|undefined) => {
            if (request != undefined && request.status == 200) {
                this.storeAccounts(request.responseText);
            }
        })
    }

    private storeAccounts(text: string) {
        sessionStorage["accounts"] = text
    }

    private storeFiles(user: string, archive: string) : void {

        // Process each file in the archive and store it under the key
        // FILE_DATA_user_filename and FILE_INFO_user_filename. Store the
        // user's account data under the key ACCOUNT_user.
        while (archive.startsWith('SOF')) {

            // Split off the header from the content
            const header = archive.substring(0,31)
            archive = archive.substring(31)

            const filename = header.slice(3, 3 + 6).trim()
            const timestamp = header.slice(9, 9+14)
            const length = +header.slice(23, 23+8).trim()

            // Now split the content of this file off the archive
            const content = archive.substring(0, length)
            archive = archive.substring(length)

            // Check we are at the end of the file
            if (!archive.startsWith("EOF"))  break

            archive = archive.substring(3)

            // This file looks valid. Is it an account or a user file?
            if (filename == "_accou") {
                sessionStorage["ACCOUNT_" + user] = content
                this.log("   ACCOUNT " + user)
            }
            else
            {
                sessionStorage[this.infoKey(false, filename)] = timestamp
                sessionStorage[this.dataKey(false, filename)] = content
                this.log("   FILE " + user + " " + filename)
            }
        }

        // Check we are at the end of the archive
        if (archive.trim() != "EOD")  {
            this.log("CORRUPT FILESPACE")
        }

    }

    public loadCatalog(username: string) {
        // Retrieve the contents of the entire catalog for a particular user.
        // The result is
        this.perform("LOADALL " + username, (request: XMLHttpRequest|undefined) => {
                    this.storeFiles(username, request.responseText)
                })
    }


    public loginUser(username: string, password: string) : boolean {
        for (const line of sessionStorage.accounts.split("\n")) {
            const [u, p] = line.split(" ")
            if (username === u && password == p) {
                this.username = username
                this.password = password
                this.log("LOGIN " + username)

                this.loadCatalog(this.username)
                this.loadCatalog('LIBRY')
                return true
            }
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // The following methods support the BASIC system's file operations
    // -------------------------------------------------------------------------

    public getAccount() : Account {
        return new Account(this, sessionStorage["ACCOUNT_" + this.username])
    }

    public saveAccount(account: string) : void {
        sessionStorage["ACCOUNT_" + this.username] = account
    }

    /**
     * Return a list of the files held in this user's catalogue (or the
     * shared library if indicated)
     *
     * We search all of the session storage for files owned by the user.
     *
     * @param isLibrary     use LIBRY instead of the logged in user.
     */
    public catalogue(isLibrary: boolean): string[] {
        const name = isLibrary ? "LIBRY" : this.username
        const prefix = "FILE_INFO_" + name + "_"
        const prefixLength = prefix.length
        let result : string[] = []
        for (const key in sessionStorage) {
            if (key.startsWith(prefix)) {
                const path = key.substring(prefixLength)
                result.push(path)
            }
        }
        result.sort()
        return result
    }

    public fileInfo(isLibrary: boolean, path: string) : any {

        // Currently, the onlyt thing the info holds is the timestemp in
        // the format ddmmyyyyhhmmss.
        const info = sessionStorage[this.infoKey(isLibrary, path)]
        const timestamp = info.substring(0,2) + "/" + info.substring(2,4) + "/" + info.substring(6, 8)

        // Get the contents of the file so we can calculate its size and
        // retrieve its file format &c
        const data = sessionStorage[this.dataKey(isLibrary, path)]

        // This seems to be an approximation to the size of the file in
        // bucket on the real system.
        const buckets = Math.ceil((data.length + 3 * 128 - 1) / (3 * 128));

        // Type is B for BASIC and so on
        const type = data[0]

        // Access is R for READ and so on
        const access = data[1]

        const result = {"name": path, "date": timestamp, "buckets": buckets, "type": type, "access": access}
        return result
    }

    public exists(isLibrary: boolean, filename: string) {
       return this.infoKey(isLibrary, filename) in sessionStorage
    }

    public saveTerminalFile(isLibrary: boolean, filename: string, type: string, access: string, contents: string[]) {
        // If the file already exists we will overwrite it.

        // The file header
    }

    public getTerminalFile(isLibrary: boolean, filename: string) : string[] {

        if (!this.exists(isLibrary, filename)) return null

        // The first line contains the file info and isn't to be returned
        // (they get that information via the fileInfo call). We just return
        // a list of the records in the file
        const data = sessionStorage[this.dataKey(isLibrary, filename)]
        return data.split("\n").slice(1)
    }

    perform(message: string, callback : (request: XMLHttpRequest) => void) : void
    {
        let ourRequest = new XMLHttpRequest();
        this.activeTransactions++;
        this.updateUI()
        this.log("SEND " + message)

        ourRequest.onload = () => {
            this.activeTransactions--
            callback(ourRequest)
            this.updateUI()
            this.log("DONE " + message)
        };

        ourRequest.onerror = () => {
            this.activeTransactions--
            callback(undefined)
            this.updateUI();
            this.log("FAIL " + message)

        }

        ourRequest.open('POST', '/cgi-bin/server.py', true);
        ourRequest.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        ourRequest.send(message);
    }
 }


 // The account class is a facade providing access to the accounting
// information held by the file store in the sessionStorage.
class Account {

    public  logins: number
    public  maxLogins: number
    public  time: number
    public  maxTime: number
    public  mill: number
    public  maxMill: number
    public  disc: number
    public  maxDisc: number

    public constructor(protected readonly owner: FileStore, accountData: string) {

        const lines = accountData.split("\n")
        wto("lines: " + lines)
        this.logins    = Account.value(lines[0], "logins")
        this.time      = Account.value(lines[1], "time")
        this.mill      = Account.value(lines[2], "mill")
        this.disc      = Account.value(lines[3], "disc")
        this.maxLogins = Account.value(lines[4], "max_logins")
        this.maxTime   = Account.value(lines[5], "max_time")
        this.maxMill   = Account.value(lines[6], "max_mill")
        this.maxDisc   = Account.value(lines[7], "max_disc")
    }



    public save() {
        let lines : string[] = [

            "logins " + this.logins,
            "time " + this.time,
            "mill " + this.mill,
            "disc " + this.disc,
            "max_logins " + this.maxLogins,
            "max_time " + this.maxTime,
            "max_mill " + this.maxMill,
            "max_disc " + this.maxDisc,
        ]

        this.owner.saveAccount(lines.join("\n"))
    }



    protected static value(record: string, label: string) : number {
        const bits = record.split(' ');
        if (bits.length == 2 && bits[0] == label) {
            return Number.parseInt(bits[1])
        }
        else {
            Utility.bugcheck("account record '" + record + "' has wrong format for " + label)
        }
    }

    public update(login: number, elapsed: number, cpu: number, disc: boolean) : void  {
        if (disc) this.updateDisc()
        this.time += elapsed
        this.mill += cpu
        this.logins += login
    }

    protected updateDisc() : void {

        // The disc space used by the users files. Note that we take the size of
        // each file in buckets rather than summing in bytes then converting to
        // buckets as we assume the bucket is the unit of file allocation.

        // Get a list of all the users files
        const files = this.owner.catalogue(false)

        // Map each filename into its size in buckets and sum the sizes
        const buckets = files.map((filename) => {
            const info = this.owner.fileInfo(false, filename)
            return info["buckets"]
        }).reduce((a, b) => a + b)

        this.disc = buckets
    }
}
