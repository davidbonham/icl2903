/// <reference path="filestore.ts" />
/// <reference path="terminal.ts" />
/// <reference path="session.ts" />

function* executer() : IterableIterator<boolean> { 
        
    let paused : boolean = false;
    wto("executer Start generating triples");
    for (let i : number = 1;; i++) {
        for (let j = 1; j < i; j++) {
            for (let k = 1; k <= j; k++) {
                if (i*i === j*j + k*k) {
                    // This is a triple
                    wto("*********** executer pausing i=" + i + " j=" + j +" k=" + k);
                    paused = true;
                }
                let action = yield paused
                paused = false;
            }
        }
    }
}

function main() {

    // The teletype we will poll for user input
    let tty = new Terminal.Terminal("ttytext")

    // The file store providing our files 
    let fs = new FileStore
    fs.initialise();

    // Perform the session. It will yield periodically: 
    // 
    // - when performing a long task or waiting for the remote file system 
    //   to respond, it will return 'busy' so that we will allow the tty 
    //   to generate events but with a timeout so we return from the poll 
    //   quickly
    //
    // - when it is waiting for more input (a new command or user input 
    //   for the running program), it will return 'blocked' so the terminal
    //   need not timeout but can await the next interrupt or entered line.
    const session = new Session.Session(tty);
 }

main()



enum Command {pause, resume, update, none};
let global_i : number = 0;
let global_j : number = 0;
let global_k : number = 0;
let global_resolve : any;

function wto(message: string) : void {
    const now = new Date();
    const time = now.getMinutes().toString() + ":" + now.getSeconds() + "." + now.getMilliseconds();
    console.log(time + " " + message);
}
function pause() {
    global_resolve(Command.pause);
}

function resume() {
    global_resolve(Command.resume);
}

function update() {
    global_i = parseInt((<HTMLInputElement>document.getElementById("i")).value);
    global_j = parseInt((<HTMLInputElement>document.getElementById("j")).value);
    global_k = parseInt((<HTMLInputElement>document.getElementById("k")).value);
    global_resolve(Command.update);
}

function expired() {
    wto("expired");
    global_resolve(Command.none);
}
function ui_process(paused : boolean) {
    return new Promise<Command>(function (resolve) {
        
        // Expose the resolve callback so that our event handlers can 
        // call it
        global_resolve = resolve;

        // If no event occurs, we need a timeout event to allow the main
        // process to continue. We only want a timeout if we are not
        // currently paused.
        if (!paused) setTimeout(expired, 100);
    });
}

function is_same(c : Command, d : Command) : boolean {
    return c == d;
}
async function triples() {
    let paused : boolean = false;
    wto("Start generating triples");
    for (let i : number = 1;; i++) {
        for (let j = 1; j < i; j++) {
            for (let k = 1; k <= j; k++) {
                if (i*i === j*j + k*k) {
                    // This is a triple
                    wto("************ i=" + i + " j=" + j +" k=" + k);
                    paused = true;
                }

                wto("await");
                const action = await ui_process(paused);
                wto("action=" + action + " i=" + i + " j=" + j + " k=" + k);
                switch (action) {
                    case Command.none: 
                        break;
                    case Command.resume:
                        wto("triples is resumed");
                        paused = false;
                        break;
                    case Command.pause:
                        wto("triples is paused");
                        paused = true;
                        break;
                    case Command.update:
                        i = global_i;
                        j = global_j;
                        k = global_k;
                        break;
                }
                wto("awaited");
            }
        }
    }
}

//triples();
