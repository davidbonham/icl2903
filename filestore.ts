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
            })}, 1000000)

        // Get user accounting info and update the object we created above
        this.perform("LOAD _ACCOUNTS", (request: XMLHttpRequest|undefined) => {
            if (request != undefined && request.status == 200) {
                sessionStorage["accounts"] = request.responseText
            }
        }) 
    }

    public loadCatalog(username: string) {
        // Retrieve the contents of the entire catalog for a particular user.
        // The result is 
    }

    public saveFile(username: string, filename: string) {
        // Locate the file in our session storage and save it back to the 
        // server
    }

    public loginUser(username: string, password: string) : boolean {
        for (const line of sessionStorage.accounts.split("\n")) {
            wto("line='" + line + "'")
            const [u, p] = line.split(" ")
            wto("u='" + u + "' p='" + p + "'")
            if (username === u && password == p) {
                this.username = username
                this.password = password
                this.log("LOGIN " + username)
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