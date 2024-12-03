const crypto = require('crypto');
const generatedCodes = new Set();

function generateUniqueCode() {
    let code;
    do {
        code = crypto.randomBytes(3).toString("hex");
        code = parseInt(code, 16).toString().slice(0, 6);
    } while (generatedCodes.has(code) || code.length < 6);
    generatedCodes.add(code);
    return code;
}

module.exports = generateUniqueCode