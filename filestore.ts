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
                sessionStorage["FILE_INFO_" + user + "_" + filename] = timestamp
                sessionStorage["FILE_DATA_" + user + "_" + filename] = content
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

    public saveFile(username: string, filename: string) {
        // Locate the file in our session storage and save it back to the
        // server
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
        return result
    }

    public fileInfo(isLibrary: boolean, path: string) : any {
        const name = isLibrary ? "LIBRY" : this.username

        // Currently, the onlyt thing the info holds is the timestemp in
        // the format ddmmyyyyhhmmss.
        const infoKey = "FILE_INFO_" + name + "_" + path
        const info = sessionStorage[infoKey]
        const timestamp = info.substring(0,2) + "/" + info.substring(2,4) + "/" + info.substring(6, 8)

        // Get the contents of the file so we can calculate its size and
        // retrieve its file format &c
        const dataKey = "FILE_DATA_" + name + "_" + path
        const data = sessionStorage[dataKey]

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