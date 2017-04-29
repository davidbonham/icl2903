import glob
import os
import re
import SimpleHTTPServer
import SocketServer
import subprocess
import sys

FTPUSER = None
FTPSITE = None
FTPPASS = None

def order_js(sources):

    # For each file, which classes does it define?
    # classes['x.js'] = ['a', 'b'] means a and b are defined in x.js
    classes = {}

    # For each file, which must it precede in the output?
    # depends_on['f.js'] = ['g.js'. 'j.js'] means f depends on g and j
    depends_on = {}

    # For each source file, extract the classes which it defines and those
    # it extends. We can ignore classes that are extended but which are
    # defined in the same file

    extends_pattern = re.compile("([0-9a-zA-Z$_]+)\s+extends\s+([0-9a-zA-Z$_]+)")
    class_pattern = re.compile("class\s+([0-9A-Za-z$_]+)")

    # Load all the source files
    content = {}
    for source in sources:
        with open(source, 'r') as data:
            content[source] = data.read()

    # Work out which classes each source file defines
    for source in sources:
        classes[source] = class_pattern.findall(content[source])

        # Assume no dependencies. We will update this later
        depends_on[source] = []

    # Now get all of the dependencies in each file
    for source in sources:

        matches = extends_pattern.findall(content[source])
        for match in matches:

            derived, base = match
            if base not in classes[source]:

                # The derived class extends the base and this file does
                # not define the base so find out which source file does.
                for source_file, defined_classes in classes.iteritems():
                    if base in defined_classes:
                        base_file = source_file
                        break

                print 'File', source, 'comes after', base_file, 'because', derived, 'extends', base
                depends_on[source].append(base_file)


    # Now define the order of output by taking the depends_on dictionary
    # and picking a file with no dependencies and adding it to the output
    # list. When we do this, remove tnis file from the dependencies of
    # the other entires. If we can't pick a file, we have a loop and our
    # job is impossible.
    output_order = []
    while len(depends_on) > 0:

        # Choose a source file
        chosen_file = None
        for source, dependencies in depends_on.iteritems():
            if dependencies == []:
                chosen_file = source
                break

        # Fail if we couldn't
        if chosen_file == None:
            print 'Error: cycle detected in source file dependencies:'
            for source, dependencies in depends_on.iteritems():
                print source, 'depends on', dependencies
            return None

        output_order.append(chosen_file)
        del depends_on[chosen_file]
        for source, dependencies in depends_on.iteritems():
            if chosen_file in dependencies:
                dependencies.remove(chosen_file)
        #print 'chose', chosen_file

    #print 'order', output_order
    return output_order


def pack(sources, target):

    # Concatenate all of the files in order, keeping a record of the line
    # at which each starts

    order = order_js(sources)
    index = {}

    next_line = 1
    concatenation = ""
    for source in order:

        concatenation += '// -- ' + source + ' --\n'
        index[source] = next_line + 1

        with open(source, 'r') as input:

            new_source = input.read()
            concatenation += new_source
            next_line += new_source.count('\n') + 1

    # Write out the dictionary
    first_line = 5 + len(index)
    longest_source = max([len(x) for x in index.keys()])
    dictionary_format = '// | %%%ds | %%5d |' % longest_source
    with open(target, 'w') as output:
        print >>output, '// Packed in order:'
        print >>output, '//'
        print >>output, '// +-%s-+-------+' % ('-'*longest_source)
        for source in order:
            print >>output, dictionary_format % (source, index[source]+first_line)
        print >>output, '// +-%s-+-------+' % ('-'*longest_source)
        print >>output, '\n'
        print >>output, concatenation






# The SimpleHTTPServer default handler will try to get the FQDN of the
# client using some netbios calls with 2s timeouts - meaning each GET
# we handle can take as much as 4s. To prevent this, we will later override
# the handler's address_string method with the following
def address_string(self):
    host, port = self.client_address[:2]
    return host

def root(relative):

    # Assume this script is in the root of our tree
    current_root = os.path.dirname(os.path.realpath(__file__))
    return os.path.join(current_root,relative)


# Make sure the environment is set up
FTPUSER = os.environ["ICL2903_FTPUSER"]
FTPSITE = os.environ["ICL2903_FTPSITE"]
FTPPASS = os.environ["ICL2903_FTPPASS"]

# Make sure the direstory structure exists
try:
    os.makedirs(os.path.join('server', 'tmpfs'))
except:
    pass


for i in range(1, len(sys.argv)):

    verb = sys.argv[i]

    if verb == 'update':

        # Build the local version of the site
        os.chdir(root(''))

        for command in ('cp index.html server/',
                        'cp tstut.css server/',
                        'cp -r filestore/* server/tmpfs',
                        'cp build/test/*.js server/',
                        'cp test/unittest.html server/',
                        'cp audio/* server/',
                        'cp teletype.ttf server/',
                        'cp lightpaperfibers.png server/'):
                subprocess.call(command, shell=True)

    elif verb == 'clean':

        subprocess.call('rm server/tmpfs/MEREWY/*', shell=True)
        subprocess.call('rm server/tmpfs/LIBRY/*', shell=True)

    elif verb == 'serve':

        try:
            os.chdir(root('server'))
            subprocess.call("python ../server.py tmpfs", shell=True)
        except KeyboardInterrupt:
            print 'stopping...'


    elif verb == 'deploy':

        os.chdir(root(''))
        print 'deploying server script...'
        subprocess.call('ncftpput -u %s -p %s -a %s /cgi-bin server.py' % (FTPUSER, FTPPASS, FTPSITE), shell=True)
        print 'deploying server files...'
        subprocess.call('ncftpput -R -u %s -p %s %s /httpdocs/icl2903 server/*' % (FTPUSER, FTPPASS, FTPSITE), shell=True)

    elif verb == "pack":

        pack(glob.glob("build/*.js")+glob.glob('build/commands/*.js')+glob.glob('build/statements/*.js'), 'server/icl2903.js')

    elif verb == "push":

        subprocess.call("git push -u origin master", shell=True)

    else:
        print 'ignored', verb
