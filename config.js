'use strict';

module.exports = {
    mailer: {
        host : "smtp.gmail.com",
        secure : true,
        auth: {
            user: 'national.creche@gmail.com',
            pass: 'creche123'
        }
    },
    dbConnectString : 'mongodb://127.0.0.1:27017/raspHost',
    sessionKey : "CheckCookieCheck",
};