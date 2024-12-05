const crypto = require('crypto');
const generatedCodes = new Set();

function generateUniqueCode() {
    return crypto.randomInt(100000, 999999)
}

module.exports = generateUniqueCode