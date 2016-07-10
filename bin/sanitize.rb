#!/usr/bin/env ruby

def sanitize(s)
  # not exhaustive - TODO: better way?
  s.
    sub(/ [\[(].*[)\]]/, "").           # (Deluxe Version) or [foo edit]
    gsub(/ß/, "ss").gsub(/œ/, "oe").
    gsub(/á/, "a").gsub(/à/, "a").gsub(/ä/, "ae").
    gsub(/é/, "e").gsub(/è/, "e").gsub(/ë/, "ee").
    gsub(/í/, "i").gsub(/ì/, "i").gsub(/ï/, "ie").
    gsub(/ó/, "o").gsub(/ò/, "o").gsub(/ö/, "oe").
    gsub(/ú/, "u").gsub(/ù/, "u").gsub(/ü/, "ue").
    gsub(/\s\s*/, "_").
    gsub(/\W/, "")                      # non alnum
end

if __FILE__ == $0
  if ARGV.length == 0
    puts "Usage: #{$0} [ artist__album | artist album ]"
    exit 0
  end

  if ARGV.length == 2
    artist = sanitize(ARGV[0])
    album = sanitize(ARGV[1])
    puts "#{artist}__#{album}"
  else
    puts sanitize(ARGV[0])
  end
end
