"use strict";

////////////////////////////////////////////////////////////////////////////////
// Response helpers
////////////////////////////////////////////////////////////////////////////////

function base_headers()
{
  return { 'Accept':          '*/*',
           'Host':            'nyia',
           'Connection':      'keep-alive',
           'Content-Type':    'application/json',
           'Content-Length':  0,
         };
}

////////////////////////////////////////////////////////////////////////////////

function start_body(body_text)
{
  let h = base_headers();
  h['Content-Length'] = body_text.length;
  return [h, body_text];
}

function append_to_body(hb, body_text)
{
  hb[0]['Content-Length'] += body_text.length;
  return [hb[0], hb[1] + body_text];
}

function as_text(response, code, hb)
{
  hb[0]['Content-Type'] = 'text/plain';
  ack(response, code, hb);
}

function as_html(response, code, hb)
{
  hb[0]['Content-Type'] = 'text/html';
  ack(response, code, hb);
}

function as_json(response, code, hb)
{
  hb[0]['Content-Type'] = 'application/json';
  ack(response, code, hb);
}

////////////////////////////////////////////////////////////////////////////////

function fail(response, body_text)
{
  fail_with_code(response, body_text, 404);
}

function fail_with_code(response, body_text, code)
{
  if (body_text) {
    body_text += '\n';
  } else {
    body_text = 'no grok\n';
  }

  if (!response) {      // startup pre-fill or a test of some kind
    return;
  }

  let hb = start_body(body_text);
  as_text(response, code, hb);
}

////////////////////////////////////////////////////////////////////////////////

function no_payload(response)
{
  let hb = start_body('');
  as_text(response, 200, hb);
}

function with_json(response, code, json)
{
  let hb = start_body(json);
  as_json(response, 200, hb);
}

function with_html(response, code, html)
{
  let hb = start_body(html);
  as_html(response, 200, hb);
}

function with_text(response, code, text)
{
  let hb = start_body(text);
  as_text(response, 200, hb);
}

function with_image(response, code, img, type)
{
  const length = img.length;
  const image = img;

  let h = base_headers();
  h['Content-Length'] = length ;
  h['Content-Type'] = 'image/' + type;

  response.writeHead(code, h);
  response.write(image, "binary");
  response.end();
}

////////////////////////////////////////////////////////////////////////////////

function ack(response, code, hb)
{
  response.writeHead(code, hb[0]);
  response.write(hb[1]);
  response.end();
}

////////////////////////////////////////////////////////////////////////////////

// Main interface
exports.with_no_payload = no_payload;
exports.with_text       = with_text;
exports.with_html       = with_html;
exports.with_json       = with_json;
exports.with_image      = with_image;

exports.fail            = fail;
exports.fail_with_code  = fail_with_code;

// Lower level interface
exports.start_body      = start_body;
exports.append_to_body  = append_to_body;

exports.as_text       = as_text;
exports.as_html       = as_html;
exports.as_json       = as_json;
