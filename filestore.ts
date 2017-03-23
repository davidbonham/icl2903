namespace FileStore
{
    let username : string = "";
    let password : string = "";

    function perform(message: string) : Promise<XMLHttpRequest> 
    {
        return new Promise<XMLHttpRequest>((resolve) =>
        {
            console.log("performing");
            let request = new XMLHttpRequest();
            request.onload = () => resolve(request);
            request.open('POST', 'http://' + window.location.host + '/icl2903/p', true);
            request.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
            request.send(message);
            console.log("sent");
        })
    }

    export function hello() : boolean { return true }
    export async function login(u : string, p: string) : Promise<boolean>
    {
        const result = await perform("LOGIN " + u + " " + p);
        const ok : boolean = result.responseText.startsWith("OK")
        if (ok) {
            username = u;
            password = p;
        }
        return ok
    }

    export async function test() {
        const result = await perform("hello world");
        console.log(result);
    }
}