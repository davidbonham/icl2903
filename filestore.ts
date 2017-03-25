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
            })}, 10000)

        // Get user accounting info and update the object we created above
        this.perform("LOAD _ACCOUNTS", (request: XMLHttpRequest|undefined) => {
            if (request != undefined && request.status == 200) {
                // We expect a sequence of lines of the form USERID password
                // and we want to place this in the session storage.
                const lines: string[] = request.responseText.split("\n")
                if (!lines[0].startsWith("ERROR")) {
                            
                    let accounts : { [name: string] : string} = {}
                    for (const line of lines.slice(1)) {
                        let [name, pass] = line.split(" ", 2)
                        accounts[name] = pass
                    }    
                    sessionStorage.accounts = accounts
                }
            }
        }) 
    }

    public fetchCatalog(username: string) {
        // Retrieve the contents of the entire catalog for a particular user.
        // The result is 
    }

    public validUser(username: string, password: string) : boolean {
        if (username in sessionStorage.accounts) {
            if (sessionStorage.accounts[username] == password) {
                return true
            }
        }
        return false;
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

        ourRequest.open('POST', 'http://' + window.location.host + '/icl2903/p', true);
        ourRequest.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
        ourRequest.send(message);
    }     
 }