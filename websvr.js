"use strict";

////////////////////////////////////////////////////////////////////////////////
// The server
////////////////////////////////////////////////////////////////////////////////
// Config

let LISTEN_PORT = 8069;

const MUSIC_ROOT_PAT    = /^\/music\//;
const REST_ROOT_PAT     = /^\/restsvr\//;
const STATIC_ROOT_PAT   = /^\/static\//;

const HTTPBIN_GET_ROOT  = '/get';     // DEBUG - mimic http://httpbin.org
const HTTPBIN_POST_ROOT = '/post';    // DEBUG - mimic http://httpbin.org

////////////////////////////////////////////////////////////////////////////////

const http = require('http');
const url  = require('url');

const debug        = require('./debug.js');
const ack          = require('./ack.js');

const music_pages  = require('./handle_music_get.js');
const music_posts  = require('./handle_music_post.js');
const static_pages = require('./handle_static.js');

// ARGV = [ "node", "script", args... ]
if (process.argv[2] == "-p") {
  if (process.argv[3]) {
    const port = parseInt(process.argv[3]);
    if (port) {
      LISTEN_PORT = port;
    }
  }
}

music_pages.init();           // pre-fill caches, etc.

http.createServer(function(request, response) {

  const url_parts = url.parse(request.url);

  //////////////////////////////////////////////////////////////////////////////

  function handle_POST() {
    let post_body = '';

    request.on('data', function (data) {
        post_body += data;
    });

    request.on('end', function () {       // called when response.end is called

      if (url_parts.pathname == HTTPBIN_POST_ROOT) {
        debug.handle_put_httpbin(response, request);
      } else
      if (url_parts.pathname.search(MUSIC_ROOT_PAT) != -1) {
        music_posts.handle_post(response, post_body, url_parts);
      } else {
        ack.fail(response, "");         // 404: Not Found
      }
    });
  }

  //////////////////////////////////////////////////////////////////////////////

  function handle_GET() {
    if (url_parts.pathname == HTTPBIN_GET_ROOT) {
      debug.handle_get_httpbin(response, request);
    } else
    if (url_parts.pathname.search(/\.html$/) != -1) {
      debug.handle_get_html(response, request, url_parts);
    } else
    if (url_parts.pathname.search(MUSIC_ROOT_PAT) != -1) {
      music_pages.handle_get(response, request, url_parts);
    } else
    if ((url_parts.pathname.search(REST_ROOT_PAT) != -1) ||
        (url_parts.pathname.search(STATIC_ROOT_PAT) != -1)) {
      static_pages.handle_get(response, request, url_parts);
    } else {
      ack.fail(response, "");         // 404: Not Found
    }
  }

  //----------------------------------------------------------------------------
  // methods done ; START handling

  if (request.method == 'POST') {
    handle_POST();
    return;
  }

  if (request.method == 'GET') {
    handle_GET();
    return;
  }

  //----------------------------------------------------------------------------

  let body = "Unknown verb: " + request.method;
  ack.fail_with_code(response, body, 501);              // 501: Not Implemented

}).listen(LISTEN_PORT);

console.log('Server is listening on port ' + LISTEN_PORT);
