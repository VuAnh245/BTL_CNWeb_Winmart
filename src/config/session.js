const session = require('express-session');

module.exports = session({
    secret: process.env.SESSION_SECRET || 'winmart-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
});