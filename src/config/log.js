'use strict'

const bunyan = require('bunyan');

let log = null;

if (process.env.PROD == 'false') {
    log = console;
} else {
    log = bunyan.createLogger({
        name: 'PokeMarket',
        streams: [{
            path: '/var/log/pokemarket.log'
        }]
    });
}

module.exports = log;