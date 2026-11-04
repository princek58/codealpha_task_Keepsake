const config = require('../../config');
const LocalStorageDriver = require('./localDriver');

const storageDriver = new LocalStorageDriver(config.storageDir);

module.exports = storageDriver;

