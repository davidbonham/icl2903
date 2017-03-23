"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var FileStore;
(function (FileStore) {
    let username = "";
    let password = "";
    function perform(message) {
        return new Promise((resolve) => {
            console.log("performing");
            let request = new XMLHttpRequest();
            request.onload = () => resolve(request);
            request.open('POST', 'http://' + window.location.host + '/icl2903/p', true);
            request.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
            request.send(message);
            console.log("sent");
        });
    }
    function hello() { return true; }
    FileStore.hello = hello;
    function login(u, p) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield perform("LOGIN " + u + " " + p);
            const ok = result.responseText.startsWith("OK");
            if (ok) {
                username = u;
                password = p;
            }
            return ok;
        });
    }
    FileStore.login = login;
    function test() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield perform("hello world");
            console.log(result);
        });
    }
    FileStore.test = test;
})(FileStore || (FileStore = {}));
