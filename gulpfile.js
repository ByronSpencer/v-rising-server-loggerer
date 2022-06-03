'use strict';

// those good gulpy methods
const { src, dest, watch, series, parallel } = require( 'gulp' );

const glob          = require( 'glob' ); // synchronous glob streaming
const fs            = require( 'fs' ); // file reader
const permissions   = require( 'gulp-chmod' ); // change file permissions
const tap           = require( 'gulp-tap' ); // file contents access
const axios         = require( 'axios' ); // make http requests

// Default task is required but we don't use it for anything
exports.default = cb => { cb(); };

const serverLog = 'logs/VRisingServer.log';
const connectionLog = 'logs/connection_log_.*.text';

const serverLogSeachPatterns = {
    // group 1: session ID, group 2: steam ID, group 3: character name, group 4: character ID
    connect: /User '\{Steam ([0-9]+)\}' '([0-9]+)', approvedUserIndex: [0-9]+, Character: '([^']+)' connected as ID '[0-9,]*', Entity '([0-9]+),1'\./,
    // group 1: session ID
    disconnect: /User '{Steam ([0-9]+)}' disconnected\./,
    // group 1: session ID, group 2: steam ID
    disconnectAlt1: /NetConnection '{Steam ([0-9]+)}' was disconnected. Reason: 'AuthTicketCanceled' PlatformId: ([0-9]+)/
}

// parse the server log file
function parseServerLog() {

}

exports['parse-server-log'] = parseServerLog;