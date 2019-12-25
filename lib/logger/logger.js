const dateFormat = require('dateformat');

const originalConsoleLog = console.log;

function logWithTime(...args) {
    const dateString = dateFormat(new Date(), 'dd.mm.yyyy HH:MM:ss');
    originalConsoleLog(dateString, ...args);
}

module.exports = {
    logWithTime
};
