#!/usr/bin/python

import sys

import BaseHTTPServer
import collections
import datetime
import os
import re
import time


global filesystem_root
filesystem_root = None

def hello_handler(request):
    return 'OK: server up'

def account_handler(command, data):

    if len(command) != 2: return "ERROR: MALFORMED ACCOUNT COMMAND"
    if len(data) != 1: return "ERROR: WRONG DATA FOR ACCOUNT COMMAND"

    # Clean the username we will use to form a path. Insist on all uppercase
    # letters.
    if not re.match("^[A-Z]{1,6}$", command[1]): return "ERROR: MALFORMED USERNAME IN ACCOUNT COMMAND"

    # The accounts file should already exist
    path = os.path.join(filesystem_root, command[1], "_account")
    if not os.path.isfile(path): return "ERROR: NO SUCH ACCOUNT"

    with open(path, "w") as account:
        account.write(data[0])

    return "OK: ACCOUNT " + command[1] + " UPDATED"

def remove_handler(command, data):

    if len(command) != 3: return "ERROR: MALFORMED REMOVE COMMAND"
    if len(data) != 0: return "ERROR: TOO MUCH DATA FOR REMOVE COMMAND"

    # Clean the username we will use to form a path. Insist on all uppercase
    # letters.
    if not re.match("^[A-Z]{1,6}$", command[1]): return "ERROR: MALFORMED USERNAME IN REMOVE COMMAND"

    # Clean the filename we will use to form a path. Insist on all uppercase
    # letters.
    if not re.match("^[A-Z][A-Z0-9#+=>&]{0,5}$", command[1]): return "ERROR: MALFORMED FILENAME IN REMOVE COMMAND"

    # The user directory must exist
    user_directory = os.path.join(filesystem_root, command[1])
    if not os.path.isdir(user_directory): return "ERROR: NO SUCH USER IN REMOVE"

    # The file should exist, but if it does not, this is a mismatch between
    # the client's file system by simply doing nothing instead
    path = os.path.join(user_directory, command[2])
    if not os.path.isfile(path): return "OK: FILE DOES NOT EXIST"

    # Remove the file
    os.remove(path)
    return "OK: FILE REMOVED"

def store_handler(command, data):

    if len(command) != 3: return "ERROR: MALFORMED STORE COMMAND"
    if len(data) != 1: return "ERROR: NO DATA FOR STORE COMMAND"

    # Clean the username we will use to form a path. Insist on all uppercase
    # letters.
    if not re.match("^[A-Z]{1,6}$", command[1]): return "ERROR: MALFORMED USERNAME IN STORE COMMAND"

    # Clean the filename we will use to form a path. Insist on all uppercase
    # letters.
    if not re.match("^[A-Z][A-Z0-9#+=>&]{0,5}$", command[1]): return "ERROR: MALFORMED FILENAME IN STORE COMMAND"

    # The user directory must exist
    user_directory = os.path.join(filesystem_root, command[1])
    if not os.path.isdir(user_directory): return "ERROR: NO SUCH USER IN STORE"

    # The file should not exist
    path = os.path.join(user_directory, command[2])
    if os.path.isfile(path): return "ERROR: FILE EXISTS IN STORE"

    with open(path, "w") as datafile:
        datafile.write(data[0])

    return "OK: STORED " + command[1] + " " + command[2]



def load_handler(command, data):

    name = command[1]
    path = os.path.join(filesystem_root, name)

    # We don't allow any path information in filenames
    if os.path.pathsep in name:
        return 'ERROR: bad file name ' + name
    elif not os.path.isfile(path):
        return 'ERROR: no such file as ' + name
    else:
        with open(path, 'r') as file:
            return 'OK: file read\n' + file.read()


def loadall_handler(command, data):
    # Given a username, contcatenate the files in that users catalogue into
    # a single response. The grammar for the result is:
    #
    # response = [file]* 'E' 'O' 'D'
    # file     = 'S' 'O' 'F' name(6A) timestamp(2d2d4d2d2d2d) length(8d) content 'E' 'O' 'F'
    # content  = length bytes each as a character. We will store binary
    #            date encoded as ascii hex, one line per record

    user = command[1]
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

def error_handler(command, DATA):
    return 'ERROR: NO HANDLER FOR REQUEST ' + command[0]

fs_handlers = {
    'LOAD'     : load_handler,
    'HELLO'    : hello_handler,
    'REMOVE'   : remove_handler,
    'STORE'    : store_handler,
    'LOADALL'  : loadall_handler,
    'ACCOUNT'  : account_handler,
}

served = {
    '/index.html'           : ('text/html', 'index.html'),
    '/tstut.css'            : ('text/css',  'tstut.css'),
    '/lightpaperfibers.png' : ('image/png', 'lightpaperfibers.png'),

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
    '/bif.js'         : ('application/javascript', 'bif.js'),
    '/basicparser.js' : ('application/javascript', 'basicparser.js'),
    '/channel.js'     : ('application/javascript', 'channel.js'),
    '/context.js'     : ('application/javascript', 'context.js'),
    '/terminal.js'    : ('application/javascript', 'terminal.js'),
    '/errorcode.js'   : ('application/javascript', 'errorcode.js'),
    '/filestore.js'   : ('application/javascript', 'filestore.js'),
    '/program.js'     : ('application/javascript', 'program.js'),
    '/scanner.js'     : ('application/javascript', 'scanner.js'),
    '/session.js'     : ('application/javascript', 'session.js'),
    '/utility.js'     : ('application/javascript', 'utility.js'),
    '/main.js'        : ('application/javascript', 'main.js'),
    '/icl2903.js'     : ('application/javascript', 'icl2903.js'),


    '/unittest.html'       : ('text/html', 'unittest.html'),
    '/filestore.spec.js'   : ('application/javascript', 'filestore.spec.js'),
    '/numeric.spec.js'     : ('application/javascript', 'numeric.spec.js'),
    '/bif.spec.js'         : ('application/javascript', 'bif.spec.js'),
    '/scanner.spec.js'     : ('application/javascript', 'scanner.spec.js'),
    '/utility.spec.js'     : ('application/javascript', 'utility.spec.js'),
    '/basicparser.spec.js' : ('application/javascript', 'basicparser.spec.js'),
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
        request = postVars.split("\n", 1)
        command = request[0].split(" ")
        data = request[1:]
        response = fs_handlers.get(command[0], error_handler)(command, data)
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

    postVars = sys.stdin.read()

    request = postVars.split("\n", 1)
    command = request[0].split(" ")
    data = request[1:]
    response = fs_handlers.get(command[0], error_handler)(command, data)

    print "Content-Type: text/plain; charset=us-ascii"
    print
    print response


if __name__ == '__main__':

    if len(sys.argv) == 2:
        filesystem_root = sys.argv[1]
        if not os.path.isdir(filesystem_root):
            print >>sys.stderr, filesystem_root, 'is not a directory'
        else:
            run()
    else:
        filesystem_root = '../httpdocs/icl2903/tmpfs'
        post()
