"use strict";

module.exports = {
    mailer: {
        host: "smtp.gmail.com",
        secure: true,
        auth: {
            user: "national.creche@gmail.com",
            pass: "creche123",
        },
    },
    dbConnectString: "mongodb://127.0.0.1:27017/raspHost",
    sessionKey: "CheckCookieCheck",
    SECRET_KEY: "Check_JWT_authentication",
    TOKEN_EXPIRY: "365d",
    USER_STORAGE_LIMIT: 1024 * 1024 * 1024 * 10, // 10 GB
};
