const dateFormat = require('dateformat');

originalLog = console.log;

function logWithTime(...args) {
    const dateString = dateFormat(new Date(), 'dd.mm.yyyy HH:MM:ss');
    originalLog(dateString, ...args);
}

module.exports = {
    logWithTime
};
