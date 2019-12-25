const dateFormat = require('dateformat');

function logWithTime(...args) {
    const dateString = dateFormat(new Date(), 'dd.mm.yyyy HH:MM:ss');
    console.log(dateString, ...args);
}

module.exports.logWithTime = logWithTime;
