"use strict";

////////////////////////////////////////////////////////////////////////////////
// Handlers for issuing shell commands
////////////////////////////////////////////////////////////////////////////////
// Config

const PANDORA_TIMEOUT_MS = 500;

////////////////////////////////////////////////////////////////////////////////

const child = require('child_process');

////////////////////////////////////////////////////////////////////////////////
// Core functions

function exec_cmd_timeout(cmd, args_array, timeout, cb)
{
  const cmd_line = cmd + " " + args_array.join(' ');

  let options = { timeout: timeout };

  child.execFile(cmd, args_array, options, function (error, stdout, stderr) {
    if (error) {
      console.log('EXEC ERROR: code=' + error.code + ', sig=' + error.signal);
    }
    console.log('#####');

    if (cb) { cb(cmd_line, error, stdout, stderr); }
  });
}

function exec_cmd(cmd, args_array, cb)
{
  exec_cmd_timeout(cmd, args_array, 0, cb);
}

// -----------------------------------------------------------------------------
// Synchronous

function synch_exec_cmd(cmd, args_array)
{
  const cmd_line = cmd + " " + args_array.join(' ');

  let stdout = null;
  try {
    stdout = child.execFileSync(cmd, args_array) + "";

    console.log('#####');

    return stdout.trim();

  } catch (error) {
    console.log("synch_exec_cmd: exec exception: (" + cmd_line + "): " + error.message);
    console.log('EXEC ERROR: code=' + error.code + ', sig=' + error.signal);      // TODO: unsure about this

    return null;
  }
}

////////////////////////////////////////////////////////////////////////////////
// Talk to iTunes via a shell script with simple commands
//  e.g. "itunescontrol.sh play" instead of "tell application ... to play"

function itunes_controller_cmd(arg, cb)
{
  exec_cmd("itunescontrol.sh", [ "-q", arg ], cb);
}

function itunes_controller_cmds(args, cb)
{
  exec_cmd("itunescontrol.sh", [ '-q' ].concat(args), cb);
}

//------------------------------------------------------------------------------
// Talk to iTunes with osascript (applescript)

function applescript_cmd(arg, cb)
{
  exec_cmd("osascript", [ "-e", "tell application \"iTunes\" to " + arg ], cb);
}

function applescript_script(script, cb)
{
  exec_cmd("osascript", [ "-e", script ], cb);
}

function fake_applescript_cmd(arg, cb)
{
  exec_cmd("echo", [ "-e", "tell application \"iTunes\" to " + arg ], cb);
}

// -----------------------------------------------------------------------------
// Synchronously

function synch_applescript_cmd(arg, cb)
{
  return synch_exec_cmd("osascript", [ "-e", "tell application \"iTunes\" to " + arg ], cb);
}

function synch_applescript_script(script, cb)
{
  return synch_exec_cmd("osascript", [ "-e", script ], cb);
}

////////////////////////////////////////////////////////////////////////////////
// Talk to pandora

function pandora_cmd(arg, cb)
{
  exec_cmd_timeout("pandoracontrol.sh", [ arg ], PANDORA_TIMEOUT_MS, cb);
}

function switch_to_itunes(arg, cb)
{
  // Pandora is playing so quit it and start (playing) iTunes instead.

  exec_cmd_timeout("pandoracontrol.sh", [ "q" ], PANDORA_TIMEOUT_MS,
                                        function (cmd_line, err, sout, serr) {
    if (err) {
      // Even if this errors out, we still want to start iTunes, so
      //  check for those special cases where we do want to stop.
      if (!err.killed || err.signal != 'SIGTERM') {
        cb(cmd_line, err, sout, serr);
        return;
      }

      // Probably no longer running..
      serr = 'Timeout: killed';
    }

    // Consolidate output from both commands
    let stdout = sout + " # ";
    let stderr = serr + " # ";

    applescript_cmd("playpause", cb, function (cmd_line, error, sout, serr) {
      stdout += sout;
      stderr += serr;

      if (cb) {
        cb("# pandora q ; tell iTunes to playpause", error, stdout, stderr);
      }
    });
  });
}

////////////////////////////////////////////////////////////////////////////////

exports.exec_cmd                  = exec_cmd;
exports.synch_exec_cmd            = synch_exec_cmd;

exports.pandora_cmd               = pandora_cmd;
exports.switch_to_itunes          = switch_to_itunes;

exports.itunes_controller_cmd     = itunes_controller_cmd;
exports.itunes_controller_cmds    = itunes_controller_cmds;

exports.applescript_cmd           = applescript_cmd;
exports.applescript_script        = applescript_script;

exports.fake_applescript_cmd      = fake_applescript_cmd;

exports.synch_applescript_cmd     = synch_applescript_cmd;
exports.synch_applescript_script  = synch_applescript_script;
