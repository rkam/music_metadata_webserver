"use strict";

////////////////////////////////////////////////////////////////////////////////
// Handle music artwork
// - mostly producing the path to the artwork from the artist album info
// - works for downloaded artwork only
//    (i.e. doesn't extract from iTunes artwork)              ##TODO
////////////////////////////////////////////////////////////////////////////////
// Config

// Artwork is expected to be in the following tree:
//  albumart/
//          full      # full size images - whatever was manually downloaded
//          300       # smaller images (300x300 or respecting aspect ratio)
//                      -- not currently used - iOS app does the downsizing
//              /jpg    in JPG format
//              /png    in PNG format
//
//          pandora   # full size images - obtained via pandora
//                        (specifically, a URL is passed as part of pandora
//                        protocol, which is handled by the player, which
//                        passes it to its eventcmd script, which I edited
//                        to download the image via curl and place here).
//
//                      NOTE: all are JPG (not sure if part of pandora spec,
//                          but it seems to be), so the code below assumes that.
//

const ARTWORK_ROOTDIR       = "./albumart/";      // ##TODO: WEBROOT or something
const ARTWORK_IMAGEDIR      = ARTWORK_ROOTDIR + "full/";
const ARTWORK_IMAGEDIR_ALT  = ARTWORK_ROOTDIR + "pandora/";
const ARTWORK_DEFAULT       = ARTWORK_ROOTDIR + "default_art_ngc891_300x300.jpg";

const MISSING_ARTWORK_LOG = ARTWORK_ROOTDIR + "missing.txt";

const BIN_DIR = "./bin/";                     // ##TODO: WEBROOT/bin or similar

////////////////////////////////////////////////////////////////////////////////

const child = require('child_process');

const utils  = require("./utils.js");
const images = require("./handle_image.js");

// State

let last_art_url = null;
let last_art_name = null;

////////////////////////////////////////////////////////////////////////////////

function log_missing_artwork(album, artist, munged)
{
  // Basically, keep track of what artwork is missing, so can fill in
  //  the gaps from iTunes (TODO: later).

  // Try to avoid repeats:
  const msg = album + "\t" + artist + "\t" + munged + '\n';

  const file = MISSING_ARTWORK_LOG;
  if (!utils.file_exists(file)) {
    utils.appendToFile(file, msg);
    return;
  }

  utils.stringInFile(file, munged, (err, found) => {
    if (err) { return; }

    if (!found) {
      utils.appendToFile(file, msg);
    }
  });
}

// Optimization: avoid all those stat calls searching for the file.
function check_last(filename)
{
  if (last_art_name == filename && last_art_url) {
    return true;
  }

  last_art_url = null;
  last_art_name = filename;

  return false;
}

function make_artwork_filename(artist, album)
{
  // The artist or album can contain all sorts of annoying characters, so
  //  map them into a single easy-to-use filename (via an external script).

  // NOTE: fails badly on error                           ##FIXME: ##TODO:
  const o = child.spawnSync(BIN_DIR + "sanitize.rb", [ artist, album ]);
  return o.stdout.slice(0, -1) + "";   // Buffer | String --> String
}

////////////////////////////////////////////////////////////////////////////////

function get_artwork_filename(json)
{
  if (!json.Artist || !json.Album) {
    return null;
  }

  const filename = make_artwork_filename(json.Artist, json.Album);
  if (!filename) {
    log_missing_artwork(json.Album, json.Artist, filename);
    return null;
  }

  return filename;
}

function artwork_exists(filename)
{
  // We don't have a type, but the default is jpg, so check for that.
  //  JPG is MUCH more likely, so check both JPG cases first
  //  Hence, if not found, check the alternate dir then for png.

  let fjpg = filename + ".jpg";
  let p = ARTWORK_IMAGEDIR + "jpg/" + fjpg;

  if (utils.file_exists(p)) {
    return p;
  }

  // Check with the alternate image directory
  //  (which seems to be only JPG, so no sub-dirs)    ## NOTE: ASSUMPTION

  p = ARTWORK_IMAGEDIR_ALT + fjpg;
  if (utils.file_exists(p)) {
    return p;
  }

  p = ARTWORK_IMAGEDIR + "png/" + filename + ".png";
  if (utils.file_exists(p)) {
    return p;
  }

  return null;
}

function set_artwork_url(json)      // to sent in the response payload
{
  const filename = get_artwork_filename(json);
  if (!filename) {
    json.ArtURL = ARTWORK_DEFAULT;
    // already logged
    return;
  }

  // Optimization: avoid file search (stat calls), if possible
  if (check_last(filename)) {
    json.ArtURL = last_art_url;
    return;
  }

  const path = artwork_exists(filename);
  if (path) {
    json.ArtURL = path;
    return;
  }

  log_missing_artwork(json.Album, json.Artist, path);
  json.ArtURL = ARTWORK_DEFAULT;
}

function verify_artwork_url(json)
{
  // If the artwork isn't known, see if we can find it based on
  //  artist + album.  Update the json.ArtURL with the actual
  //  image path or the path to the default image.
  //
  // Otherwise, see if the specified path already exists, if not
  //  try the above.
  //
  // End result is that json.ArtURL points to a valid image file.

  if (json.ArtURL.length === 0) {
    set_artwork_url(json);
  } else
  if (!utils.check_url_path(json.ArtURL)) {
    set_artwork_url(json);
  }

  last_art_url = json.ArtURL;
  return json.ArtURL;
}

////////////////////////////////////////////////////////////////////////////////

function handle_get(response, request, url_parts, type)
{
  const path = url_parts.pathname.substr("/music/".length);
  images.handle_get(response, request, path, type);
}

////////////////////////////////////////////////////////////////////////////////

exports.verify_artwork_url = verify_artwork_url;
exports.handle_get         = handle_get;
