/// <reference path="terminal.ts" />
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var Session;
(function (Session_1) {
    class Session {
        constructor(terminal) {
            this.terminal = terminal;
        }
        ;
        perform() {
            return __awaiter(this, void 0, void 0, function* () {
                // This is a stub session so all we do is repeatedly poll the 
                // terminal and display the response we receive until we are
                // asked to stop
                for (;;) {
                    const result = yield this.terminal.poll();
                    if (result.kind === 1 /* Quit */)
                        break;
                    console.log(result);
                }
            });
        }
    }
    Session_1.Session = Session;
})(Session || (Session = {}));
