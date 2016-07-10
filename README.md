# music_metadata_webserver
node.js web server for music metadata - one of a set of projects for my LAN

Simple web server that serves up metadata from a static file on the system.
  (which is another project I have - it subscribes to iTunes and writes the
 metadata on a song change)

There is POST support for controlling iTunes (just the basics).
  (which also requires another project - basically it uses an existing shell
   script I had that talks to iTunes from any system. - It also uses applescript
   (via osacript), but not much)

There is some POST minimal support a pandora interface: [pianobar](https://github.com/PromyLOPh/pianobar)
  (which, again, requires another project - here, a custom eventcmd.sh script
   that also populates the above mentioned file).
  - My custom pianobar event script writes its metadata, so pandora display is fully supported.

# Caveats

The other parts of the system aren't on github yet; this is the first
(I'm working on it..)

Also requires some system state - e.g. an artwork folder, lyrics folder. Although,
     it works without it - it'll just be noisy.

# History

I started out with a bash script to control iTunes (on my music server) from
my laptop.  - I have speakers in every room of the house, so I needed a way
to control iTunes when not at the server.

I also created an OSX service that subscribes to iTunes events and both
writes the current song's metadata to a local file and also services requests
from my other boxes for that metadata (those also write a local file).  I then
had GeekTool grab from those files and show it on laptop desktop - actually any
box in my LAN.

Later, I wrote an iOS app to display and control iTunes from my iPhone and to
support that, I wrote this webserver.

So, this project leveraged off the others that I already had.  I'm working on
consolidating and/or publishing those other parts of the system I have.

I also have an Internet of Things server that I will probably merge into this
server.  Although, now that I know javascript/node.js, I may try some other
technology, like Sinatra.

