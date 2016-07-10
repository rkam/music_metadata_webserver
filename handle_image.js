"use strict";

////////////////////////////////////////////////////////////////////////////////
// Handle GET image
////////////////////////////////////////////////////////////////////////////////

const fs  = require("fs");

const ack = require('./ack.js');

////////////////////////////////////////////////////////////////////////////////

function handle_get(response, request, path, image_type)
{
  return fs.readFile(path, 'binary', function (error, data) {

    if (error) {
      let err = "ERROR: Cannot get image (" + path + "): " + error + ".";
      ack.fail_with_code(response, err, 400);    // 400: Bad Request
      return;
    }

    if (!data) {       // ##TODO: needed? - shouldn't happen
      let err  = "ERROR: no image returned for (" + path + ")";
      ack.fail_with_code(response, err, 500);    // 500 Internal Server Error
      return;
    }

    ack.with_image(response, 200, data, image_type);
  });
}

////////////////////////////////////////////////////////////////////////////////

exports.handle_get = handle_get;
