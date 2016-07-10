"use strict";

////////////////////////////////////////////////////////////////////////////////
// Main entry point for all music POST URLs (everything from /music down)
////////////////////////////////////////////////////////////////////////////////
// Config

const CTRLR_PATH  = /^\/music\/controller/;

const play_shuffle_script = '' +
  //
  // http://stackoverflow.com/questions/14674517/how-to-set-itunes-11-in-shuffle-or-repeat-mode-via-applescript
  // answered May 17 '15 at 19:28    by     d-b
  //
  // NOTE: clicking menus requires special access to be granted
  //        (Security & Privacy -> Privacy -> Accessibility -> +Terminal
  //
  'tell application "System Events"\n' +
  '  tell process "iTunes" to if exists then\n' +
  '    click menu item "Songs" of menu "Shuffle" of menu item "Shuffle" of menu "Controls" of menu bar 1\n' +
  '    click menu item "On"    of menu "Shuffle" of menu item "Shuffle" of menu "Controls" of menu bar 1\n' +
  '  end if\n' +
  'end tell\n' +
  'tell application "iTunes" to play\n' +
'';

////////////////////////////////////////////////////////////////////////////////

const ack   = require('./ack.js');
const utils = require('./utils.js');
const cmds  = require('./cmdline.js');
const music = require('./music_gs_to_json.js');

////////////////////////////////////////////////////////////////////////////////

function play_check(response, json, accurate)
{
  if (accurate) {
    return !music.get_actual_is_playing;                //  pretty accurate
  }

  // Not terribly accurate
  const itunes  = music.iTunesIsPlaying;
  const pandora = music.PandoraIsPlaying;

  const not_playing = !itunes && !pandora;

  if (!json.hasOwnProperty("action")) {                 // iTunes Only
    return not_playing;
  }

  if (music.PlayerState == "[Stopped]") {     // as opposed to, say, [Paused]
    if (json.action == "pause") {
      // Stopped and want to Pause -> change to play
      json.action = "play";
    }

    // ensure shuffle when starting from stopped
    if (json.action == "play") {
      json.action = "playshuffle";
    }
  }

  const want_to_play = json.action.substring(0, "play".length) === "play";
  return not_playing && want_to_play;
}

function handle_post(response, post_body, url_parts)
{
  if (url_parts.pathname.search(CTRLR_PATH) == -1) {
    ack.fail(response, "");       // just 404 is fine.
    return;
  }

  const json = JSON.parse(post_body);
  if (!json) {
    let err = "error parsing payload";
    ack.fail_with_code(response, err, 400);         // 400: Bad Request
    return;
  }

  if (play_check(response, json, true)) {
    ack.fail_with_code(response, "iTunes is not playing.", 503);    // 503 Service Unavailable
    return;
  }

  // I have a (bash) script to control iTunes from any box in my LAN. It
  //  does both simple commands (tell iTunes to playpause) and more complex
  //  stuff (skip to next song and increment played by 1) as well as having
  //  it target the correct box where iTunes plays.  This is the "ic" script
  //  (iTunes controller).
  //
  // For performance and since the webserver is the same box as the iTunes
  //  app, we can perform simple commands (i.e. applescript via osascript).
  //
  // This is run via an action table.  The table is indexed by the request JSON
  //   payload and offers up a function and an argument to that function.
  //   (namely, a function to invoke an external script and its argument)
  //
  // The table and its code handle three cases:
  //
  // GENERAL form:
  //      "JSON command" :  { function_arg, function }
  //
  //  where: 'function_arg' can be the actual function parameter or '#'
  //
  //  If former, then invocation is:   function(function_arg, cb);
  //  otherwise,      invocation is:   function(derived_arg,  cb);
  //    where derived_arg is either:
  //          { 'value' : derived_arg }
  //        or
  //          derived from running through the "other_cases-table" and
  //            invoking it's function and using that.
  //
  // e.g.
  //    A)   'op'  : { c: 'arg', f: func } with JSON { 'action' : 'op' }
  //                ===>  func('arg')
  //
  //    B)   'op'  : { c: '#',   f: func } with JSON { 'action' : 'op',
  //                                                   'value'  : 'arg' }
  //                ===>  func('arg')
  //
  //    C)   'op'  : { c: '#',   f: func } with JSON { 'action' : 'op2',
  //                                                   'part_1' : 'ar',
  //                                                   'part_2' :  'g'
  //                                                  }
  //          intermediate forms:
  //
  //          func returns:
  //            { 'action' : 'op2', 'value' :  json.part_1 + json.part_2 }
  //          i.e.:
  //            { 'action' : 'op2', 'value' : 'arg' }
  //          which matches case B) JSON and hence
  //                ===>  func2('arg')

  // TODO: make this an object

  const pandora_script_actions = {         // match KEY -> f(c)
    'love':       { 'c': '=', 'f': cmds.pandora_cmd, },   // love
    'nextSong':   { 'c': '-', 'f': cmds.pandora_cmd, },   // ban
    'skipSong':   { 'c': 'n', 'f': cmds.pandora_cmd, },   // next
    'back':       { 'c': 't', 'f': cmds.pandora_cmd, },   // tired

      // Can't start pandora, and pause is weird (for long pauses)
      //  so use play button to stop pandora and start itunes
    'playpause':  { 'c': 'play',  'f': cmds.switch_to_itunes, },
    'play':       { 'c': 'play',  'f': cmds.switch_to_itunes, },
    'pause':      { 'c': 'pause', 'f': cmds.switch_to_itunes, },
  };

  const itunes_script_actions = {         // match KEY -> f(c)

    // Simple commands for applescript
    'play':       { 'c': 'playpause',
                    'f': cmds.applescript_cmd, },
    'playshuffle': { 'c': play_shuffle_script,
                     'f': cmds.applescript_script, },
    'pause':      { 'c': 'playpause',
                    'f': cmds.applescript_cmd, },
    'playpause':  { 'c': 'playpause',
                    'f': cmds.applescript_cmd, },
    'back':       { 'c': 'back track',        // beg of current song or prev song (if at beg)
                    'f': cmds.applescript_cmd, },
    'prevSong':   { 'c': 'previous track',    // previous track
                    'f': cmds.applescript_cmd, },
    'skipSong':   { 'c': 'next track',        // next track
                    'f': cmds.applescript_cmd, },
    // More complicated than simple 'tell iTunes to XYZ'
    'nextSong':   { 'c': 'next',              // next track (marking this as played)
                    'f': cmds.itunes_controller_cmd, },
    'rewind':     { 'c': 'rew',               // Currently, 2s pause -> += 10s song
                    'f': cmds.itunes_controller_cmd, },      // -- prob. want 'back'
    'resume':     { 'c': 'resume',
                    'f': cmds.itunes_controller_cmd, },
    'forward':    { 'c': 'forw',              // Currently, 2s pause -> -= 10s song
                    'f': cmds.itunes_controller_cmd, },      // -- prob. want 'skip'

/*
* Implemented as ic script commands currently
    'rewind':     { 'c': 'rewind',            // WARNING:        rew MODE
                    'f': cmds.applescript_cmd, },
    'forward':    { 'c': 'fast forward',      // WARNING:        fforw MODE
                    'f': cmds.applescript_cmd, },
    'resume':     { 'c': 'resume',            // End MODE (re: previous 2 cmds)
                    'f': cmds.applescript_cmd, },
*/

    // love and rate take an argument, so it's not a simple 'action'
    // i.e. above are basically "{ 'action' : 'play' }"
    //      these are           "{ 'rate'   : '80' }"
    // TODO: make these an action as well (e.g. "{ 'action' : 'rate', 'value' : '80' }"


    'love':       { 'c': '#',                 // USED BELOW WITH other_cases (e.g. not via .action)
                    'f': function (loved, cb) {
                           cmds.itunes_controller_cmds([ "loved", loved ], cb);
                         },
                  },
    'rate':       { 'c': '#',                 // USED BELOW WITH other_cases (e.g. not via .action)
                    'f': function (rating, cb) {
                           cmds.applescript_cmd("set rating of current track to \"" + rating + "\"", cb);
                         },
                  },
  };

  console.log((music.PandoraIsPlaying ? "pandora" : "itunes") + " command ");

  // If iTunes is not playing, it's fine - we may want to start it.
  utils.post_via_action_table(response, json,
        music.PandoraIsPlaying ? pandora_script_actions : itunes_script_actions,
                                 function (cmd_line, error, stdout, stderr) {
    let output = "stdout=" +  stdout + "stderr=" +  stderr;

    if (error) {
      let e = "" + error.code;
      if (error.signal) {
        e = "code=" + e + ", sig=" + error.signal;
      }
      let err = cmd_line + ":\nERROR: " + e + "\n" + output;
      ack.fail_with_code(response, err, 400);         // 400: Bad Request
      return;
    }

    let out = cmd_line + ":\n" + output;
    ack.with_text(response, 200, out);
  });
}

////////////////////////////////////////////////////////////////////////////////

exports.handle_post = handle_post;   // anything below HTTP_ROOT/music
