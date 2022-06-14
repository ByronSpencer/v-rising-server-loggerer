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

/**
 * File locations
 */
const files = {
    serverLog: 'logs/VRisingServer.log',
    connectionLog: 'logs/connection_log_.*.text',
    cleanLog: 'clean-log.json'
}

/**
 * RegExp patterns for finding users in the server log
 */
const serverLogSeachPatterns = {
    // group 1: session ID, group 2: steam ID, group 3: character name, group 4: character ID
    connect: /User '\{Steam ([0-9]+)\}' '([0-9]+)', approvedUserIndex: [0-9]+, Character: '([^']+)' connected as ID '[0-9,]*', Entity '([0-9]+),1'\./g,
    // group 1: session ID
    disconnect: /User '{Steam ([0-9]+)}' disconnected\./g
}

/**
 * Check if a string is a JSON structure
 * @param {string} str 
 * @returns boolean
 */
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

/**
 * Change strings to numbers in regexp exec results
 * @param {Array} results 
 * @returns Array
 */
function numberfyRegExResults( results ) {
    return results.map( (r, i) => {
        // if index is not 3, change string to number
        if( i !== 3 ) return parseInt( r );
        return r;
    } )
}

/**
 * Find current status of all users from the server log
 * @returns Promise
 */
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

            // find all instances of users connecting, add them to array or overwrite if present
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

/**
 * Get the status of the server from the connection log
 * @returns Promise
 */
function getServerStatusFromConnectionLog() {
    return new Promise( (resolve, reject) => {
        console.log( 'getting server status' );
        resolve( true );
    });
}

/**
 * Update the clean log file with user info
 * @param {Array} users 
 * @returns 
 */
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

            // account for users who were in the clean log previously but are not in the server log since restart
            storedUsers.forEach( su => {
                if( !users.find( u => u.characterId === su.characterId ) ) {
                    su.statusOnline = false;
                    users.push( su );
                }
            })

            log.users = users;

            // update file
            file.contents = Buffer.from( JSON.stringify( log, null, '\t' ) );

        }))
        .pipe( dest( './' ) );
}

/**
 * Gulp task for updating clean log
 * @returns Promise
 */
function updateTask() {

    let users = [];

    // if the clean log doesn't exist we need to create it
    if( !fs.existsSync( files.cleanLog ) ) {
        fs.writeFileSync( files.cleanLog, JSON.stringify({
            users: [],
            statusUp: false
        }));
    }

    // update clean log from raw logs
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