'use strict';

// those good gulpy methods
const { src, dest, watch, series, parallel } = require( 'gulp' );

const glob          = require( 'glob' ); // synchronous glob streaming
const fs            = require( 'fs' ); // file reader
const permissions   = require( 'gulp-chmod' ); // change file permissions
const tap           = require( 'gulp-tap' ); // file contents access
const axios         = require( 'axios' ); // make http requests
const gulpChmod = require('gulp-chmod');
const { isWhileStatement } = require('typescript');

// Default task is required but we don't use it for anything
exports.default = cb => { cb(); };

const files = {
    serverLog: 'logs/VRisingServer.log',
    connectionLog: 'logs/connection_log_.*.text',
    cleanLog: 'clean-log.json'
}

const serverLog = 'logs/VRisingServer.log';
const connectionLog = 'logs/connection_log_.*.text';

const serverLogSeachPatterns = {
    // group 1: session ID, group 2: steam ID, group 3: character name, group 4: character ID
    connect: /User '\{Steam ([0-9]+)\}' '([0-9]+)', approvedUserIndex: [0-9]+, Character: '([^']+)' connected as ID '[0-9,]*', Entity '([0-9]+),1'\./g,
    // group 1: session ID
    disconnect: /User '{Steam ([0-9]+)}' disconnected\./g
}

// parse the server log file
function parseServerLog() {

    const userTracker = [];

    

    return src( files.cleanLog )
        .pipe( tap( file => {
            const newLog = file.contents;
            console.log( JSON.parse( newLog.toString() ) );


            fs.readFile( glob.sync( files.serverLog )[0], {}, ( err, contents ) => {
                let connection;
                let disconnection;
                let uIdx = -1;
        
                // check connections first and set initial statuses for each user
                let re = new RegExp( serverLogSeachPatterns.connect );
                while( connection = re.exec( contents ) ) {
                    uIdx = userTracker.findIndex( user => user.steamId === connection[2] );
        
                    if( uIdx > -1 ) {
                        userTracker[ uIdx ].lastSession = connection[1];
                        userTracker[ uIdx ].lastLogIndex = re.lastIndex;
                    }
                    else {
                        userTracker.push( {
                            characterName: connection[3],
                            status: 'online',
                            characterId: connection[4],
                            steamId: connection[2],
                            lastSession: connection[1],
                            lastLogIndex: re.lastIndex
                        } );
                    }
                }
        
                // now we check disconnects to see who is offline
                re = new RegExp( serverLogSeachPatterns.disconnect );
                while( disconnection = re.exec( contents ) ) {
                    uIdx = userTracker.findIndex( user => user.lastSession === disconnection[1] );
        
                    if( uIdx > -1 ) {
                        if( re.lastIndex > userTracker[ uIdx ].lastLogIndex ) {
                            userTracker[ uIdx ].status = 'offline';
                        }
                        userTracker[ uIdx ].lastLogIndex = re.lastIndex;
                    }
                }
        
                console.log( userTracker );
            });
            
        }));
}

exports['parse-server-log'] = parseServerLog;