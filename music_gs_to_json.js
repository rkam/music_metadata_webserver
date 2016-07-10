"use strict";

////////////////////////////////////////////////////////////////////////////////
// Find and return the information about the current song.
//  There is another script/process that runs that gets information
//    directly from iTunes (anywhere on the local network) and dumps that
//    to a common file(name) for easy access to processes like us.
////////////////////////////////////////////////////////////////////////////////
//
// iTunes Music GeekStatus to JSON
//    (data file for GeekTool desktop screen display)
//
//    NOTE: I don't use geektool anymore, but the name lingers..
//          GeekTool was limited to simple shell statements (e.g. sed -e 2p),
//          so this file format is just textual data on a particular well-known
//          line in the file.
////////////////////////////////////////////////////////////////////////////////
// Config

const INFO_FILE   = "/tmp/.geekstatus";
const PANDORA_PAT = /Pandora [Ss]tation:/;

const DEFAULT_MAJOR   = "0";
const DEFAULT_MINOR   = "3";

////////////////////////////////////////////////////////////////////////////////

const fs = require("fs");

const ack     = require('./ack.js');
const cmds    = require('./cmdline.js');
const artwork = require("./music_artwork.js");

const debug   = require('./debug.js');

////////////////////////////////////////////////////////////////////////////////
// State

// for handle_test()
const TEST_FILE = "_test_data/sample_music_summary_test_in.xxx";
let testing = false;

////////////////////////////////////////////////////////////////////////////////

const DEFAULT_VERSION =  DEFAULT_MAJOR + "." + DEFAULT_MINOR;

let Accurate_position = null;         // Empty means it's pending
let Last_accurate_position = null;
let Last_song = null;

let iTunesIsPlaying = false;
let PandoraIsPlaying = false;
let PlayerState = "";

const iTunes_is_running_script  = '' +
  'tell application "System Events"\n' +
  '  set ProcessList to name of every process\n' +
  '  if "iTunes" is in ProcessList then\n' +
  '    return "true"\n' +
  '  end if\n' +
  'end tell\n' +
  'return "false"\n' +
'';

////////////////////////////////////////////////////////////////////////////////

function get_actual_is_running()
{
  const b = cmds.synch_applescript_script(iTunes_is_running_script);
  if (!b) {
    console.log("iTunes is not running");
  }
  return b;
}

function get_actual_is_playing()
{
  if (get_actual_is_running()) {
    return cmds.synch_applescript_cmd("player state as string") == "playing";
  }

  return false;
}

function get_accurate_position()
{
  if (Accurate_position) {
    return;
  }

  if (!get_actual_is_running()) {
    return;
  }

  // Accurate implies synchronous
  // NOTE: it still depends on the osascript latency and the overall web
  //       request latency, but we'll minimize our part.
  Accurate_position = cmds.synch_applescript_cmd("get player position as Integer");
}

////////////////////////////////////////////////////////////////////////////////

function encodeValuesInPlace(json)
{
  Object.keys(json).forEach(function (ele) {
    json[ele] = encodeURIComponent(json[ele]);
  });
}

////////////////////////////////////////////////////////////////////////////////

function nullJSON(major, minor, pstate)
{
  let json = {};

  json.majorVersion   = major;
  json.minorVersion   = minor;
  json.PlayerState    = pstate;
  json.Title          = "<song>";
  json.Artist         = "<artist>";
  json.Album          = "<album>";
  json.Length         = 0;
  json.Position       = 0;

  set_accurate_field(json, true);

  json.TitleWithYear  = "";
  json.Rated          = "";
  json.ArtURL         = "";
  json.PositionLength = "";
  json.Lyrics         = "";
  json.Year           = "";
  json.Rating         = "";
  json.Rest           = "";

  return json;
}

function set_accurate_field(json, is_accurate)
{
  // NOTE: VERSIONING heads-up
  //  Instead of sending back a specific property based on the version,
  //  just send them all back.

  if (!testing) {
    json.accurate = is_accurate;            // 0.1 only
    json.IsAccuratePos = is_accurate;       // 0.2 and onwards
  }

  const major = json.majorVersion;
  const minor = json.minorVersion;

  if ((major + "." + minor) == "0.1") {
    json.accurate = is_accurate;
  } else {
    json.IsAccuratePos = is_accurate;
  }
}

// The input data file was designed for something else and so provides
//    summary lines for several pieces of data.  We need to split them
//    out, since the clients expect properties.

function set_position_fields(json, lines)
{
  // Format:
  //
  // position/length    # int, int
  //
  // NOTE: this is at the time the file was written and it is NOT real-time
  //        (hence the Accurate_position stuff)
  if (!Last_song || Last_song != json.Title) {
    Last_song = json.Title;
    Last_accurate_position = null;
    Accurate_position = null;
  }

  let pandora_playing = (lines[0].search(PANDORA_PAT) != -1);
  exports.PandoraIsPlaying = pandora_playing;
  exports.iTunesIsPlaying = !pandora_playing;
  if (!exports.iTunesIsPlaying) {
    Accurate_position = null;
  }

  const posLen = json.PositionLength.split('/');
  json.Length = posLen[1];

  let is_accurate = false;
  if (!Accurate_position) {
    json.Position = Last_accurate_position ? Last_accurate_position :
                                             posLen[0];
    is_accurate = 'false';
  } else {
    json.Position = Accurate_position;
    is_accurate = 'true';

    Last_accurate_position = Accurate_position;
    Accurate_position = null;
  }

  set_accurate_field(json, is_accurate);
}

function splitTitleYearLoved(json)
{
  // Format:
  //
  // "Title" or "Title (Year)" or "Title (Year Loved)"
  // Loved is the unicode heart character

  const r = json.TitleWithYear.match(/\(\d{4}/);
  if (!r) {
    json.Title = json.TitleWithYear;
    return;
  }

  const titleYear = json.TitleWithYear.split('(');
  json.Title = titleYear[0].trim();

  let y = titleYear.pop();
  y = y.substr(0, y.length-1);

  // Either 'yyyy' or 'yyyy <3'  where <3 is emoji single-char heart
  const yl = y.split(' ');
  json.Year = yl[0];

  if (yl.length == 1) {
    json.Loved = 'false';
  } else {
    json.Loved = 'true';       // yl[1];
  }
}

function getRating(json)
{
  // Format:
  //
  // Rest is "Artist Album Pos% RatingInStars

  if (!json.Rest || !json.Rated || json.Rated == 'noRating') {
    json.Rating = "";
    json.Rest = "";
    return;
  }

  const blahRating = json.Rest.split('%');

  if (!blahRating || blahRating.length != 2) {
    debug.dump_json(json);
    json.Rating = "0";
    json.Rest = "";
    return;
  }

  const rating = blahRating[1].trim();

  // _ = shouldn't happen
  if (!rating || rating == "_") {
    debug.dump_json(json);
    json.Rating = "0";
    json.Rest = "";
    return;
  }

  // - = rated 0
  if (rating == "-") {
    json.Rating = "0";
    json.Rest = "";
    return;
  }

  const r = rating;
  let n = r.length;
  let v = 0;
  if (r[n] == "½") {
    v += 10;
    n--;
  }
  while(n--) {
    v += 20;
  }

  json.Rating = "" + v;
  // TODO: there are some UNICODE issues here, so don't send it - it's not
  //        really needed anyway (info is redundant or extracted)
  json.Rest = "";
}

function parse_geekstatus(response, major, minor, data, cb)
{
  if (data[data.length-1] != "\n") {
    data += "\n";
  }
  const lines = data.split("\n");

  if (lines.length < 7) {
    let err = "Short '" + INFO_FILE + "' file.";
    ack.fail_with_code(response, err, 503);    // 503 Service Unavailable
    return;
  }

  exports.PlayerState = lines[0];
  let artist = lines[2];
  if (artist.length === 0 || artist == "(null)") {
    console.log("No info in '" + INFO_FILE + "' file.");

    let json = nullJSON(major, minor, exports.PlayerState);
    encodeValuesInPlace(json);
    cb(json);
    return;
  }

  // [Playing]
  // Champs Elysées (2014)                                         # Title Yr
  // Zaz                                                           # Artist
  // Paris                                                         # Album
  // Zaz                                                       Paris    6%     _
  // noRating
  // <artwork URL>
  // 11/177                                                        # Pos/Len
  // <Zaz  Champs Elysées>   OR    Pandora Station: female         # Lyrics
  // <Paris>                 OR    Zaz | Champs Elysées | Paris
  //
  // <empty>

  let json = {};

  let i = 0;
  json.majorVersion   = major;
  json.minorVersion   = minor;
  json.PlayerState    = lines[i++];
  json.TitleWithYear  = lines[i++];
  json.Artist         = lines[i++];
  json.Album          = lines[i++];
  json.Rest           = lines[i++];
  json.Rated          = lines[i++];
  json.ArtURL         = lines[i++];
  json.PositionLength = lines[i++];
  lines.splice(0, i);
  json.Lyrics         = "";
  json.Lyrics         = lines.join("\n");

  // NOTE: VERSIONING heads-up
  //  Instead of sending back a specific property based on the version,
  //  just send them all back.
  if (!testing || major > 0 || minor > 2) {
    json.canSync = exports.iTunesIsPlaying;       // 0.3 and onwards
  }

  // ##TODO Since not using GeekTool, should just refactor service to
  //        put one data item per line, instead of crafting a summary
  //        (or *additionally* add each item as separate line)
  getRating(json);
  splitTitleYearLoved(json);
  set_position_fields(json, lines);

  json.ArtURL = artwork.verify_artwork_url(json);

  encodeValuesInPlace(json);
  cb(json);
}

////////////////////////////////////////////////////////////////////////////////

function validate_and_split_version(response, requested_version)
{
  if (requested_version.length < 3) {
    return null;
  }
  const loc = requested_version.search(/\./);
  if (loc == -1) {
    return null;
  }

  let major = requested_version.substr(0, loc);
  let minor = requested_version.substr(loc+1, requested_version.length-1);

  if (isNaN(major) || isNaN(minor)) {
    return null;
  }

  return [ major, minor ];
}

function handle_get_common(response, requested_version,
                           want_accurate, input_file, cb)
{
  let major = DEFAULT_MAJOR;
  let minor = DEFAULT_MINOR;
  if (requested_version) {
    let r = validate_and_split_version(response, requested_version);
    if (!r) {
      let err = "Invalid version (" + requested_version + ")";
      ack.fail_with_code(response, err, 400);       // 400 Bad Request
      return;
    }
    major = r[0];
    minor = r[1];
  }

  // Read the file.
  return fs.readFile(input_file, 'utf-8', function (error, data) {
    if (error) {
      let err = "ERROR info file read:'" + error + "'.";
      ack.fail_with_code(response, err, 400);         // 400: Bad Request
      return;
    }

    if (want_accurate) {
      get_accurate_position();
    }

    parse_geekstatus(response, major, minor, data, cb);
  });
}

////////////////////////////////////////////////////////////////////////////////

function handle_get_summary(response, requested_version, want_accurate, cb)
{
  handle_get_common(response, requested_version, want_accurate, INFO_FILE, cb);
}

////////////////////////////////////////////////////////////////////////////////

function handle_test(response, request, url_parts, url_path)
{
  testing = true;

  const verloc = url_path.search(/\/\d+\.\d+$/);    // NOTE: matches leading '/'

  let requested_version;
  if (verloc == -1) {
    requested_version = DEFAULT_VERSION;
  } else {
    requested_version = url_path.substr(verloc+1, url_path.length-1);
  }

  const want_accurate = (url_parts.query && url_parts.query.search(/accurate/) != -1);

  handle_get_common(response, requested_version, want_accurate, TEST_FILE,
                    function(json) { // NOTE: callback only called on success

    if (!json) {
      let err = "TEST: Internal error: Cannot get json summary.";
      ack.fail_with_code(response, err, 500);    // 500 Internal Server Error
      return;
    }

    json.Position = "xyzzy";    // This is dynamic, so make it fixed for testing

    const s = JSON.stringify(json);
    if (!s) {
      let err = 'TEST: Cannot parse json summary (into string).';
      ack.fail_with_code(response, err, 500);    // 500 Internal Server Error
      return;
    }

    ack.with_json(response, 200, s);
  });
}

////////////////////////////////////////////////////////////////////////////////

if (require.main === module) {

  handle_get_summary( function(json) {
    console.dir(json, { colors: true, depth: null} );
  });

  // NOTE: callback only called on success
}

////////////////////////////////////////////////////////////////////////////////

exports.defaultVersion        = DEFAULT_VERSION;
exports.DEFAULT_MAJOR         = DEFAULT_MAJOR;
exports.DEFAULT_MINOR         = DEFAULT_MINOR;

exports.handle_get_summary    = handle_get_summary;

exports.handle_test           = handle_test;

exports.get_actual_is_playing = get_actual_is_playing;
exports.iTunesIsPlaying       = iTunesIsPlaying;
exports.PandoraIsPlaying      = PandoraIsPlaying;
exports.PlayerState           = PlayerState;
