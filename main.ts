/// <reference path="filestore.ts" />
/// <reference path="terminal.ts" />
/// <reference path="session.ts" />



function main() {
    wto("enter main")
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
    const session = new Session.Session(tty, fs);
    session.handleAsleep()
    wto("exit main")
}

function wto(message: string) : void {
    const now = new Date();
    const time = now.getMinutes().toString() + ":" + now.getSeconds() + "." + now.getMilliseconds();
    console.log(time + " " + message);
}
