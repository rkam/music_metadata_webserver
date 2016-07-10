"use strict";

////////////////////////////////////////////////////////////////////////////////
// Handle static files - i.e. entire actual files; not dynamic data nor partials
////////////////////////////////////////////////////////////////////////////////

const fs = require("fs");

const ack    = require('./ack.js');
const images = require('./handle_image.js');

////////////////////////////////////////////////////////////////////////////////

function handle_get_static_file(response, url_path, ack_sender)
{
  function check_path (p) {
    try {
      fs.accessSync(p, fs.R_OK);
      return null;
    } catch (err) {
      return err;
    }
  }

  const err = check_path(url_path);
  if (err) {
    ack.fail_with_code(response, "stat: " + err, 403);  // 403: Forbidden (could be ENOEXIST)
    return;
  }

  // Read the file.
  return fs.readFile(url_path, function (error, data) {
    if (error) {
      ack.fail_with_code(response, error, 400);         // 400: Bad Request
    }

    ack_sender(response, 200, data);
  });
}

function handle_get_text(response, url_path)
{
  handle_get_static_file(response, url_path, ack.with_text);
}

function handle_get_html(response, url_path)
{
  handle_get_static_file(response, url_path, ack.with_html);
}

function handle_get_json(response, url_path)
{
  handle_get_static_file(response, url_path, ack.with_json);
}

////////////////////////////////////////////////////////////////////////////////

// Get the contents of a file. (static data, not a script, and the entire file)
function get_file(response, request, url_parts)
{
  const path = "." + url_parts.pathname;        // absolute to relative

  const loc = path.lastIndexOf('.');
  if (loc == -1) {
    let err = "ERROR: ##FORNOW, all paths must end in an extension";
    ack.fail_with_code(response, err, 300);     // 300 Multiple Choices
    return;
  }

  const ext = path.substr(loc+1, path.length-loc);

  switch (ext) {
    case "htm":
    case "html":
      handle_get_html(response, path);
      return;

    case "json":
      handle_get_json(response, path);
      return;

    case "txt":
      handle_get_text(response, path);
      return;

    case "png":
      images.handle_get(response, request, path, "jpg");
      return;

    case "jpg":
      images.handle_get(response, request, path, "png");
      return;

    default:
      break;
  }

  let err = "Unknown extension: '" + ext + "'\n";
  ack.fail_with_code(response, err, 300);     // 300 Multiple Choices
}

exports.handle_get_text = handle_get_text;
exports.handle_get_html = handle_get_html;
exports.handle_get_json = handle_get_json;

exports.handle_get      = get_file; // anything below HTTP_ROOT/{static|restsvr}
