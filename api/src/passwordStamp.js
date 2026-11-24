const crypto = require('crypto');
module.exports = senha => crypto.createHmac('sha256', require('./jwtSecret')).update(String(senha)).digest('hex');
