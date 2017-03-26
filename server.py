import BaseHTTPServer
import collections
import os
import time

def hello_handler(request):
    return 'OK: server up'

def load_handler(request):

    name = request[1]

    # We don't allow any path information in filenames
    if os.path.pathsep in name:
        return 'ERROR: bad file name ' + name
    elif not os.path.isfile(name):
        return 'ERROR: no such file as ' + name
    else:
        with open(name, 'r') as file:
            return 'OK: file read\n' + file.read()

def error_handler(request):
    return 'ERROR: no handler for request "' + ' '.join(request) + '"'

fs_handlers = {
    'LOAD'  : load_handler,
    'HELLO' : hello_handler,
}

served = {
    '/index.html'   : ('text/html', 'index.html'),
    '/tstut.css'     : ('text/css', 'tstut.css'),
    '/tty.mp3'      : ('audio/mpeg', 'tty.mp3'),
    '/ttykey.wav'   : ('audio/x-wav', 'ttykey.wav'),
    '/space.wav'    : ('audio/x-wav', 'space.wav'),
    '/teletype.ttf' : ('application/x-font-truetype', 'teletype.ttf'),

    '/terminal.js'  : ('application/javascript', 'terminal.js'), 
    '/filestore.js' : ('application/javascript', 'filestore.js'), 
    '/session.js'   : ('application/javascript', 'session.js'), 
    '/utility.js'   : ('application/javascript', 'utility.js'), 
    '/main.js'     : ('application/javascript', 'main.js'), 

    '/unittest.html' : ('text/html', 'test/unittest.html'),
    '/filestore.spec.js' : ('application/javascript', 'test/filestore.spec.js'), 
}

# Map from session id to its queue
sessions = {}

queue = collections.deque()

class MyHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def address_string(self):
        host, port = self.client_address[:2]
        return host

    def transmit(s, type, basename):
        with open(basename, 'rb') as source:
            s.send_response(200)
            s.send_header("Content-type", type)
            s.end_headers()
            s.wfile.write(source.read())

    def do_GET(s):

        if s.path in served:
            mime, real = served[s.path]
            s.transmit(mime, real)
        else:
            s.send_response(404)
            s.end_headers()

    def do_POST(s):

        varLen = int(s.headers['Content-Length'])
        postVars = s.rfile.read(varLen)
        print '%d bytes:' % varLen
        print postVars
        request = postVars.split()
        response = fs_handlers.get(request[0], error_handler)(request)
        s.send_response(200)
        s.send_header("Content-type", 'text/plain; charset=us-ascii')
        s.end_headers()
        s.wfile.write(response)


def run():

    server_class = BaseHTTPServer.HTTPServer
    httpd = server_class(('', 8000), MyHandler)
    httpd.serve_forever()


run()