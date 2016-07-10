"use strict";

////////////////////////////////////////////////////////////////////////////////
// Debugging functions
////////////////////////////////////////////////////////////////////////////////

const ack = require('./ack.js');

////////////////////////////////////////////////////////////////////////////////

function dump_from_string(type, string)
{
  if (type.search(/json$/) != -1) {
    dump_json_from_string(string);
    return;
  }
  console.dir(string, {depth: null, colors: true});
  console.log('##');
}

function dump_json_from_string(json_string)
{
  dump_json(JSON.parse(json_string));
  console.log('##');
}

function dump_json(json_obj)
{
  console.dir(json_obj, {depth: null, colors: true});
  console.log('__');
}

////////////////////////////////////////////////////////////////////////////////

// Useful when no internet
function httpbin_ack(response)           // Unit Test: mimic http://httpbin.com/
{
  const httpbin_response = '{ "origin": "unknown", "url": "http://nyia/" }\n';

  ack.with_json(response, 200, httpbin_response);
}

function handle_get_httpbin(response, request)
{
  console.log('  --> mimic httpbin.org/get (From: ' + request.headers["user-agent"] + ")");

  httpbin_ack(response);
}

function handle_post_httpbin(response, request)
{
  console.log('  ==> mimic httpbin.org/post (From: ' + request.headers["user-agent"] + ")");

  httpbin_ack(response);
}

////////////////////////////////////////////////////////////////////////////////

// Basic functionality (i.e. connectivity)
function handle_get_html(response, request)
{
  console.log('  -> html body (From: ' + request.headers["user-agent"] + ")");

  // This could just be a string and submitted as ack.with_html(), but
  //  keep it like this as an example of doing it low-level.

  let hb = ack.start_body('<!DOCTYPE \'html\'>\n');

  hb = ack.append_to_body(hb, '<html>');
  hb = ack.append_to_body(hb, '<head>');
  hb = ack.append_to_body(hb, '<title>Hello World!</title>');
  hb = ack.append_to_body(hb, '</head>\n');
  hb = ack.append_to_body(hb, '<body>');
  hb = ack.append_to_body(hb, 'Hello World!');
  hb = ack.append_to_body(hb, '</body>');
  hb = ack.append_to_body(hb, '</html>\n');

  ack.as_html(response, 200, hb);
}

////////////////////////////////////////////////////////////////////////////////

exports.dump_from_string      = dump_from_string;
exports.dump_json_from_string = dump_json_from_string;
exports.dump_json             = dump_json;

exports.handle_get_httpbin    = handle_get_httpbin;
exports.handle_post_httpbin   = handle_post_httpbin;

exports.handle_get_html       = handle_get_html;
