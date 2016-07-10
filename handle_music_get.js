"use strict";

////////////////////////////////////////////////////////////////////////////////
// Main entry point for all music GET URLs (everything from /music down)
////////////////////////////////////////////////////////////////////////////////
// Config

const MUSIC_PATH  = /^\/music\/summary/;
const TEST_PATH   = /^\/music\/test/;

const WANT_ACCURATE_POSITION_ATTRIBUTE_NAME   = "accurate";

////////////////////////////////////////////////////////////////////////////////

const ack     = require('./ack.js');
const artwork = require('./music_artwork.js');
const music   = require('./music_gs_to_json.js');
const debug   = require('./debug.js');

////////////////////////////////////////////////////////////////////////////////

function handle_music_summary(response, request, url_parts, url_path)
{
  // URL is either NO_VERSION_PATH or VERSION_PATH/major.minor

  const verloc = url_path.search(/\/\d+\.\d+$/);    // NOTE: matches leading '/'
  let requested_version = (verloc == -1) ?
                                  music.defaultVersion :
                                  url_path.substr(verloc+1, url_path.length-1);

  const want_accurate = (url_parts.query &&
          url_parts.query.indexOf(WANT_ACCURATE_POSITION_ATTRIBUTE_NAME) != -1);

  music.handle_get_summary(response, requested_version, want_accurate, function(json) {
    if (!json) {
      ack.fail_with_code(response, 'Cannot get json summary.', 500);    // 500 Internal Server Error
      return;
    }

    const s = JSON.stringify(json);
    if (!s) {
      let err = 'Cannot parse json summary (into string).';
      ack.fail_with_code(response, err, 500);    // 500 Internal Server Error
      return;
    }

    ack.with_json(response, 200, s);
  });
}

////////////////////////////////////////////////////////////////////////////////

function handle_get(response, request, url_parts)
{
  const url_path = url_parts.pathname;

  if (url_path.search(TEST_PATH) != -1) {
    music.handle_test(response, request, url_parts, url_path);
    return;
  }

  if (url_path.search(/\.jpg$/) != -1) {
    artwork.handle_get(response, request, url_parts, "jpg");
    return;
  }

  if (url_path.search(/\.png$/) != -1) {
    artwork.handle_get(response, request, url_parts, "png");
    return;
  }

  if (url_path.search(MUSIC_PATH) != -1) {
    handle_music_summary(response, request, url_parts, url_path);
    return;
  }

  ack.fail(response, "");         // 404: Not Found
}

// When the sever first starts up it doesn't read the info file and
//  that's a bit annoying, so provide a method to do (just) that.
function init()
{
  const accurate = music.get_actual_is_playing();

  // response is only needed if there's an error. Then the callee will want
  //  to call one of the ack.fail methods.  Those check for null response, so
  //  this is ok.

  const response = null;
  music.handle_get_summary(response, music.defaultVersion, accurate, function(json) {
    if (!json) {
      console.log("INIT: Internal error: Cannot get json summary.");
      return;
    }

    const s = JSON.stringify(json);
    if (!s) {
      console.log("INIT: Cannot parse json summary (into string).'");
      return;
    }

    debug.dump_from_string('json', s);
  });
}

////////////////////////////////////////////////////////////////////////////////

exports.init        = init;
exports.handle_get  = handle_get;    // anything below HTTP_ROOT/music
