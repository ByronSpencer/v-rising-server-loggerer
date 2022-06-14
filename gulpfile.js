'use strict';

// those good gulpy methods
const { src, dest, watch, series, parallel } = require( 'gulp' );

const glob          = require( 'glob' ); // synchronous glob streaming
const fs            = require( 'fs' ); // file reader
const chmod         = require( 'gulp-chmod' ); // change file permissions
const tap           = require( 'gulp-tap' ); // file contents access
const axios         = require( 'axios' ); // make http requests

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

function hasJsonStructure( str ) {
    if (typeof str !== 'string') return false;
    try {
        const result = JSON.parse(str);
        const type = Object.prototype.toString.call(result);
        return type === '[object Object]' 
            || type === '[object Array]';
    } catch (err) {
        return false;
    }
}

function numberfyRegExResults( results ) {
    return results.map( (r, i) => {
        if( i !== 3 ) return parseInt( r );
        return r;
    } )
}

function getUserInfoFromServerLog() {
    const users = [];

    return new Promise( (resolve, reject) => {
        fs.readFile( glob.sync( files.serverLog )[0], {}, ( err, contents ) => {
            // connection search
            let connection;
            // disconnection search
            let disconnection;
            // user index
            let uIdx = -1;
            // check connections first and set initial statuses for each user
            let re = new RegExp( serverLogSeachPatterns.connect );

            if( err ) {
                reject( err );
                return;
            }

            while( connection = re.exec( contents ) ) {
                connection = numberfyRegExResults( connection );
                uIdx = users.findIndex( user => user.steamId === connection[2] );
    
                if( uIdx > -1 ) {
                    users[ uIdx ].lastSession = connection[1];
                    users[ uIdx ].lastLogIndex = re.lastIndex;
                }
                else {
                    users.push( {
                        characterName: connection[3],
                        statusOnline: true,
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
                disconnection = numberfyRegExResults( disconnection );
                uIdx = users.findIndex( user => user.lastSession === disconnection[1] );
    
                if( uIdx > -1 ) {
                    if( re.lastIndex > users[ uIdx ].lastLogIndex ) {
                        users[ uIdx ].statusOnline = false;
                    }
                    users[ uIdx ].lastLogIndex = re.lastIndex;
                }
            }

            resolve( users );
        });
    });
}

function getServerStatusFromConnectionLog() {
    return new Promise( (resolve, reject) => {
        console.log( 'getting server status' );
        resolve( true );
    });
}

function updateCleanLog( users ) {
    return src( files.cleanLog )
        .pipe( chmod( {
            read: true,
            write: true,
            execute: true
        }))
        .pipe( tap( file => {
            const fileStr = file.contents.toString();
            const log = hasJsonStructure( fileStr ) ? JSON.parse( fileStr ) : {};
            const storedUsers = log.users || [];

            storedUsers.forEach( su => {
                if( !users.find( u => u.characterId === su.characterId ) ) {
                    su.statusOnline = false;
                    users.push( su );
                }
            })

            log.users = users;

            file.contents = Buffer.from( JSON.stringify( log, null, '\t' ) );

        }))
        .pipe( dest( './' ) );
}

function updateTask() {

    let users = [];

    return getUserInfoFromServerLog()
    .then( u => {
        users = u;
        return getServerStatusFromConnectionLog();
    })
    .then( s => {
        return updateCleanLog( users );
    });
}

exports['update'] = updateTask;