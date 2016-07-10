"use strict";

////////////////////////////////////////////////////////////////////////////////
// General utilites
////////////////////////////////////////////////////////////////////////////////

const fs  = require('fs');

const ack = require('./ack.js');

////////////////////////////////////////////////////////////////////////////////
// POST ops are based on a table - this processes that table
//  basically: json -> table entry -> invoke func in entry (with possible arg)

function do_action(action_table, action_cmd, action_param, cb)
{
  const sact = action_table[action_cmd];
  if (!sact) {
    return false;
  }

  if (sact.c == '#') {
    sact.f(action_param, cb);
  } else {
    sact.f(sact.c, cb);
  }
  return true;
}

function post_via_action_table(response, json, action_table, cb)
{
  if (json.action) {
    // { 'action' : 'op' } or { 'action' : 'op', 'value' : arg }
    const action = json.action;
    const arg = json.value ? json.value : null;
    if (do_action(action_table, action, arg, cb)) {
      return;
    }
  }

  ack.fail_with_code(response, "POST: ENOIMPL", 501);   // 501 Not Implemented
}

////////////////////////////////////////////////////////////////////////////////
// Various file and system related functions

function file_exists(p)       // synchronous
{
  try {
    fs.accessSync(p, fs.R_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function appendToFile(file, msg)
{
  fs.open(file, 'a', (err, fd) => {
    if (err) {
      console.log("Error opening log for missing artwork (msg): " + err.message);
      return;
    }

    fs.write(fd, msg, (err) => {
      if (err) {
        console.log("Error logging missing artwork (msg): " + err.message);
        return;
      }

      fs.close(fd, () => { });
    });
  });
}

function stringInFile(file, str, cb)
{
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) {
      console.log("Error logging missing artwork (msg): " + err.message);
      return (err, false);
    }

    // always looking for fixed string, so no need for:
    //    str.search(regex);    // str.search(/pat/);

    if (data.toString().indexOf(str) > -1) {
      cb(null, true);
      return;
    }
    cb(null, false);
  });
}

function check_url_path(p)
{
  if (p.search(/^file:\/\//) == -1) {
    return null;
  }

  const pl = "file://".length;
  p = p.substr(pl, p.length-pl);
  return file_exists(p);
}

////////////////////////////////////////////////////////////////////////////////

exports.post_via_action_table = post_via_action_table;

exports.stringInFile    = stringInFile;
exports.appendToFile    = appendToFile;

exports.file_exists     = file_exists;       // synchronous
exports.check_url_path  = check_url_path;    // synchronous
