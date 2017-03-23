/// <reference path="filestore.ts" />
/// <reference path="terminal.ts" />
/// <reference path="session.ts" />
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let terminal = new Terminal.Terminal("ttytext");
let session = new Session.Session(terminal);
console.log("login " + FileStore.login("MEREWY", "SA08"));
//session.perform();
var Command;
(function (Command) {
    Command[Command["pause"] = 0] = "pause";
    Command[Command["resume"] = 1] = "resume";
    Command[Command["update"] = 2] = "update";
    Command[Command["none"] = 3] = "none";
})(Command || (Command = {}));
;
let global_i = 0;
let global_j = 0;
let global_k = 0;
let global_resolve;
function wto(message) {
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
    global_i = parseInt(document.getElementById("i").value);
    global_j = parseInt(document.getElementById("j").value);
    global_k = parseInt(document.getElementById("k").value);
    global_resolve(Command.update);
}
function expired() {
    wto("expired");
    global_resolve(Command.none);
}
function ui_process(paused) {
    return new Promise(function (resolve) {
        // Expose the resolve callback so that our event handlers can 
        // call it
        global_resolve = resolve;
        // If no event occurs, we need a timeout event to allow the main
        // process to continue. We only want a timeout if we are not
        // currently paused.
        if (!paused)
            setTimeout(expired, 100);
    });
}
function is_same(c, d) {
    return c == d;
}
function triples() {
    return __awaiter(this, void 0, void 0, function* () {
        let paused = false;
        wto("Start generating triples");
        for (let i = 1;; i++) {
            for (let j = 1; j < i; j++) {
                for (let k = 1; k <= j; k++) {
                    if (i * i === j * j + k * k) {
                        // This is a triple
                        wto("************ i=" + i + " j=" + j + " k=" + k);
                        paused = true;
                    }
                    wto("await");
                    const action = yield ui_process(paused);
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
    });
}
//triples();
