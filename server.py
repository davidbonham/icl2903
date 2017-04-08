#!/usr/bin/python


import sys

import BaseHTTPServer
import collections
import datetime
import os
import time


global filesystem_root
filesystem_root = None

def hello_handler(request):
    return 'OK: server up'

def load_handler(request):

    name = request[1]
    path = os.path.join(filesystem_root, name)

    # We don't allow any path information in filenames
    if os.path.pathsep in name:
        return 'ERROR: bad file name ' + name
    elif not os.path.isfile(path):
        return 'ERROR: no such file as ' + name
    else:
        with open(path, 'r') as file:
            return 'OK: file read\n' + file.read()


def loadall_handler(request):
    # Given a username, contcatenate the files in that users catalogue into
    # a single response. The grammar for the result is:
    #
    # response = [file]* 'E' 'O' 'D'
    # file     = 'S' 'O' 'F' name(6A) timestamp(2d2d4d2d2d2d) length(8d) content 'E' 'O' 'F'
    # content  = length bytes each as a character. We will store binary
    #            date encoded as ascii hex, one line per record

    user = request[1]
    userpath = os.path.join(filesystem_root, user)
    if not os.path.isdir(userpath): return 'ERROR: no catalogue for user "' + user + '"'

    # No need to tree walk as catalogues are flat
    catalog = ''
    for filename in os.listdir(userpath):

        path = os.path.join(userpath, filename)
        if os.path.isdir(path): continue

        # Calculate the fields we need for the header. Some are held in
        # the first line of the file

        # Name padded with trailing spaces to six characters
        name = (filename + '     ')[:6]

        # Time stamp day(01-31), month(01-12), year(xxxx), hours(00-23), minutes(00-59), seconds(00-59)
        timestamp = datetime.datetime.fromtimestamp(os.path.getmtime(path)).strftime('%d%m%Y%H%M%S')

        with open(path, 'r') as file:
            content = file.read()
        length = '%8d' % len(content)

        entry = 'SOF' + name + timestamp + length + content + 'EOF'
        catalog += entry

    catalog += 'EOD'
    return catalog

def error_handler(request):
    return 'ERROR: no handler for request "' + ' '.join(request) + '"'

fs_handlers = {
    'LOAD'     : load_handler,
    'HELLO'    : hello_handler,
    'LOADALL' : loadall_handler,
}

served = {
    '/index.html'     : ('text/html', 'index.html'),
    '/tstut.css'      : ('text/css', 'tstut.css'),

    '/tty.mp3'        : ('audio/mpeg',  'tty.mp3'),
    '/ttykey.wav'     : ('audio/x-wav', 'ttykey.wav'),
    '/space.wav'      : ('audio/x-wav', 'space.wav'),
    '/travelling.wav' : ('audio/x-wav', 'travelling.wav'),
    '/crlf.wav'       : ('audio/x-wav', 'crlf.wav'),
    '/printonce.wav'  : ('audio/x-wav', 'printonce.wav'),
    '/silence.wav'    : ('audio/x-wav', 'silence.wav'),
    '/typeonce.wav'   : ('audio/x-wav', 'typeonce.wav'),

    '/teletype.ttf'   : ('application/x-font-truetype', 'teletype.ttf'),

    '/ast.js'         : ('application/javascript', 'ast.js'),
    '/basicparser.js' : ('application/javascript', 'basicparser.js'),
    '/terminal.js'    : ('application/javascript', 'terminal.js'),
    '/errorcode.js'   : ('application/javascript', 'errorcode.js'),
    '/filestore.js'   : ('application/javascript', 'filestore.js'),
    '/program.js'     : ('application/javascript', 'program.js'),
    '/scanner.js'     : ('application/javascript', 'scanner.js'),
    '/session.js'     : ('application/javascript', 'session.js'),
    '/utility.js'     : ('application/javascript', 'utility.js'),
    '/main.js'        : ('application/javascript', 'main.js'),

    '/unittest.html'       : ('text/html', 'test/unittest.html'),
    '/filestore.spec.js'   : ('application/javascript', 'test/filestore.spec.js'),
    '/scanner.spec.js'     : ('application/javascript', 'test/scanner.spec.js'),
    '/basicparser.spec.js' : ('application/javascript', 'test/basicparser.spec.js'),
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

    print 'serving...'
    server_class = BaseHTTPServer.HTTPServer
    httpd = server_class(('', 8000), MyHandler)
    httpd.serve_forever()


def post():

    import cgitb
    cgitb.enable()
    import cgi

    command = sys.stdin.read()

    request = command.split()
    response = fs_handlers.get(request[0], error_handler)(request)
    print "Content-Type: text/plain; charset=us-ascii"
    print
    print response


if __name__ == '__main__':

    if len(sys.argv) == 2:
        filesystem_root = sys.argv[1]
        if not os.path.isdir(filesystem_root):
            print >>stderr, filesystem_root, 'is not a directory'
        else:
            run()
    else:
        filesystem_root = '../httpdocs/icl2903/tmpfs'
        post()
